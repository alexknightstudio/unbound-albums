import { NextResponse, type NextRequest } from "next/server";

import { parseCover } from "@/lib/albums/cover";
import { TEMPLATES_BY_CODE } from "@/lib/engine/templates";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

/**
 * The album's link-preview image — what iMessage/WhatsApp show when a couple
 * texts their share link to family. OG crawlers need a STABLE public URL
 * (signed storage URLs expire between the share and the re-crawl), so this
 * route serves the bytes itself: the unguessable slug is the capability,
 * exactly as it is for the share page.
 *
 * Picks the cover hero when one is chosen, else the first spread's
 * emphasis-slot photo, else any photo on the first spread.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;

  const admin = createAdminClient();
  const { data: album } = await admin
    .from("albums")
    .select("id, status, cover")
    .eq("share_slug", slug)
    .maybeSingle<{ id: string; status: string; cover: unknown }>();

  if (
    !album ||
    (album.status !== "ready" &&
      album.status !== "ordered" &&
      album.status !== "shipped")
  ) {
    return new NextResponse(null, { status: 404 });
  }

  let photoId = parseCover(album.cover).hero_photo_id;

  if (!photoId) {
    const { data: firstSpread } = await admin
      .from("spreads")
      .select("template_code, slots")
      .eq("album_id", album.id)
      .order("position", { ascending: true })
      .limit(1)
      .maybeSingle<{ template_code: string; slots: Record<string, string> }>();
    if (firstSpread) {
      const template = TEMPLATES_BY_CODE.get(firstSpread.template_code);
      const emphasisSlot = template?.slots.find((s) => s.emphasis)?.id;
      photoId =
        (emphasisSlot ? firstSpread.slots[emphasisSlot] : undefined) ??
        Object.values(firstSpread.slots)[0] ??
        null;
    }
  }
  if (!photoId) return new NextResponse(null, { status: 404 });

  const { data: photo } = await admin
    .from("photos")
    .select("thumb_path")
    .eq("id", photoId)
    .eq("album_id", album.id)
    .maybeSingle<{ thumb_path: string | null }>();
  if (!photo?.thumb_path) return new NextResponse(null, { status: 404 });

  const { data: file } = await admin.storage
    .from("thumbs")
    .download(photo.thumb_path);
  if (!file) return new NextResponse(null, { status: 404 });

  return new NextResponse(await file.arrayBuffer(), {
    headers: {
      "Content-Type": "image/jpeg",
      // Crawlers and chat apps may re-fetch; a day of caching is plenty and
      // a changed cover propagates within it.
      "Cache-Control": "public, max-age=86400",
    },
  });
}
