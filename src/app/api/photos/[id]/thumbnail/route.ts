import { NextResponse, type NextRequest } from "next/server";
import sharp from "sharp";

import { THUMB_LONG_EDGE, THUMB_QUALITY, orientationFor } from "@/lib/photos/thumbnails";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

// A 60MP export takes ~300ms to process, but it has to be pulled out of storage
// first. Generous, since the alternative is a photo with no thumbnail forever.
export const maxDuration = 60;

type PhotoRow = {
  id: string;
  album_id: string;
  storage_path: string;
  thumb_path: string | null;
};

/**
 * Generates a photo's thumbnail and records its orientation.
 *
 * Called by the uploader once the bytes have landed. Reading the image server-side
 * rather than in the browser is deliberate: iOS Safari caps canvas area at ~16.7MP,
 * so a 60MP export silently produces a blank thumbnail there.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  // The couple's own client, so RLS decides whether this photo is theirs to
  // touch. The admin client below is only used once that's established.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const { data: photo } = await supabase
    .from("photos")
    .select("id, album_id, storage_path, thumb_path")
    .eq("id", id)
    .maybeSingle<PhotoRow>();

  // RLS already filtered this: another couple's photo reads as absent.
  if (!photo) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  // Idempotent — a retried upload shouldn't redo the work.
  if (photo.thumb_path) {
    return NextResponse.json({ ok: true, cached: true });
  }

  const admin = createAdminClient();

  const { data: file, error: downloadError } = await admin.storage
    .from("originals")
    .download(photo.storage_path);

  if (downloadError || !file) {
    return NextResponse.json(
      { error: "Could not read the original." },
      { status: 502 },
    );
  }

  const input = Buffer.from(await file.arrayBuffer());

  let thumbnail;
  try {
    thumbnail = await sharp(input)
      // Applies the EXIF orientation tag and strips it, so the pixels are
      // upright for everyone. Phone photos carry the tag; Lightroom exports
      // have it baked in already. This handles both.
      .rotate()
      .resize(THUMB_LONG_EDGE, THUMB_LONG_EDGE, {
        fit: "inside",
        withoutEnlargement: true,
      })
      .jpeg({ quality: THUMB_QUALITY })
      .toBuffer({ resolveWithObject: true });
  } catch {
    // A file we can't decode shouldn't wedge the album. The photo stays,
    // thumbnail-less, and the couple can remove it.
    return NextResponse.json(
      { error: "That photo couldn't be read." },
      { status: 422 },
    );
  }

  const thumbPath = `${photo.album_id}/${photo.id}.jpg`;

  // Couples can read the thumbs bucket but not write it, so this needs admin.
  const { error: uploadError } = await admin.storage
    .from("thumbs")
    .upload(thumbPath, thumbnail.data, {
      contentType: "image/jpeg",
      upsert: true,
    });

  if (uploadError) {
    return NextResponse.json(
      { error: "Could not save the thumbnail." },
      { status: 502 },
    );
  }

  // Measured after rotate+resize, so orientation reflects what a viewer sees
  // rather than how the sensor happened to be held.
  const orientation = orientationFor(thumbnail.info.width, thumbnail.info.height);

  const { error: updateError } = await admin
    .from("photos")
    .update({ thumb_path: thumbPath, orientation })
    .eq("id", photo.id);

  if (updateError) {
    return NextResponse.json({ error: "Could not save." }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    orientation,
    width: thumbnail.info.width,
    height: thumbnail.info.height,
  });
}
