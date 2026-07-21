import { randomUUID } from "node:crypto";

import { NextResponse, type NextRequest } from "next/server";
import sharp from "sharp";

import {
  abortMultipartUpload,
  completeMultipartUpload,
  createMultipartUpload,
  galleryKeys,
  getObjectBytes,
  objectExists,
  putObject,
  r2Configured,
  signedPartUrl,
} from "@/lib/galleries/r2";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * The photographer upload lifecycle. The browser PUTs file parts straight to
 * R2 via presigned URLs — our servers never carry upload bandwidth. Every
 * action re-verifies gallery ownership; part URLs are only ever signed for
 * keys inside this gallery's own prefix.
 */

export const PART_SIZE = 10 * 1024 * 1024; // 10 MB parts — resumable units.
const MAX_FILE_BYTES = 200 * 1024 * 1024; // Edited JPEGs, not RAW (spec §5).
const THUMB_EDGE = 1600;

const EXT_BY_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
};

type Body =
  | { action: "create"; filename: string; size: number; contentType: string }
  | { action: "sign-parts"; key: string; uploadId: string; partNumbers: number[] }
  | {
      action: "complete";
      key: string;
      uploadId: string;
      photoId: string;
      filename: string;
      size: number;
      parts: Array<{ PartNumber: number; ETag: string }>;
    }
  | { action: "abort"; key: string; uploadId: string };

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!r2Configured()) {
    return NextResponse.json(
      { error: "Storage isn't configured yet. Add the R2 credentials to .env.local." },
      { status: 503 },
    );
  }

  const { id: galleryId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  // RLS scopes this select to the owner; a miss means not-yours-or-absent.
  const { data: gallery } = await supabase
    .from("galleries")
    .select("id")
    .eq("id", galleryId)
    .maybeSingle<{ id: string }>();
  if (!gallery) {
    return NextResponse.json({ error: "Gallery not found." }, { status: 404 });
  }

  const body = (await request.json().catch(() => null)) as Body | null;
  if (!body || typeof body !== "object" || !("action" in body)) {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }

  const keyPrefix = `g/${galleryId}/o/`;
  const ownKey = (key: unknown): key is string =>
    typeof key === "string" && key.startsWith(keyPrefix) && !key.includes("..");

  try {
    switch (body.action) {
      case "create": {
        const ext = EXT_BY_TYPE[body.contentType];
        if (!ext) {
          return NextResponse.json(
            { error: "JPEG or PNG only — galleries deliver edited photos." },
            { status: 415 },
          );
        }
        if (!Number.isFinite(body.size) || body.size <= 0 || body.size > MAX_FILE_BYTES) {
          return NextResponse.json(
            { error: "That file is larger than a delivery photo should be." },
            { status: 413 },
          );
        }
        const photoId = randomUUID();
        const key = galleryKeys.original(galleryId, photoId, ext);
        const uploadId = await createMultipartUpload(key, body.contentType);
        return NextResponse.json({ photoId, key, uploadId, partSize: PART_SIZE });
      }

      case "sign-parts": {
        if (!ownKey(body.key) || !Array.isArray(body.partNumbers)) {
          return NextResponse.json({ error: "Bad request." }, { status: 400 });
        }
        const partNumbers = body.partNumbers
          .filter((n) => Number.isInteger(n) && n >= 1 && n <= 10000)
          .slice(0, 200);
        const urls = await Promise.all(
          partNumbers.map(async (partNumber) => ({
            partNumber,
            url: await signedPartUrl(body.key, body.uploadId, partNumber),
          })),
        );
        return NextResponse.json({ urls });
      }

      case "complete": {
        if (!ownKey(body.key) || !Array.isArray(body.parts) || body.parts.length === 0) {
          return NextResponse.json({ error: "Bad request." }, { status: 400 });
        }
        // Idempotent: a retried complete (row insert failed last time, or the
        // response was lost) finds the multipart already finalized — if the
        // object exists, carry on to the metadata instead of failing.
        try {
          await completeMultipartUpload(body.key, body.uploadId, body.parts);
        } catch (error) {
          if (!(await objectExists(body.key))) throw error;
        }

        // Thumb: pull the original back (R2 egress is free), downscale once,
        // store beside it. The grid never loads originals.
        const original = await getObjectBytes(body.key);
        const thumbKey = galleryKeys.thumb(galleryId, body.photoId);
        const { data: thumb, info } = await sharp(original)
          .rotate()
          .resize(THUMB_EDGE, THUMB_EDGE, { fit: "inside", withoutEnlargement: true })
          .jpeg({ quality: 82 })
          .toBuffer({ resolveWithObject: true });
        await putObject(thumbKey, thumb, "image/jpeg");
        const meta = await sharp(original).metadata();

        // A retried complete may already have its row.
        const { data: existing } = await supabase
          .from("gallery_photos")
          .select("id")
          .eq("id", body.photoId)
          .maybeSingle();
        if (existing) return NextResponse.json({ ok: true, photoId: existing.id });

        // Concurrent files race for the next position — the unique
        // (gallery_id, position) constraint referees; losers recount and retry.
        for (let attempt = 0; attempt < 5; attempt++) {
          const { data: last } = await supabase
            .from("gallery_photos")
            .select("position")
            .eq("gallery_id", galleryId)
            .order("position", { ascending: false })
            .limit(1)
            .maybeSingle<{ position: number }>();
          const { data: row, error } = await supabase
            .from("gallery_photos")
            .insert({
              id: body.photoId,
              gallery_id: galleryId,
              r2_key: body.key,
              thumb_key: thumbKey,
              filename: String(body.filename).slice(0, 255),
              size_bytes: body.size,
              width: meta.width ?? info.width,
              height: meta.height ?? info.height,
              position: (last?.position ?? 0) + 1,
            })
            .select("id")
            .maybeSingle();
          if (row) return NextResponse.json({ ok: true, photoId: row.id });
          // 23505 = unique_violation: someone took the position; try again.
          if (error?.code !== "23505") break;
        }
        return NextResponse.json(
          { error: "Uploaded, but could not record the photo. Retry the file." },
          { status: 500 },
        );
      }

      case "abort": {
        if (!ownKey(body.key)) {
          return NextResponse.json({ error: "Bad request." }, { status: 400 });
        }
        await abortMultipartUpload(body.key, body.uploadId);
        return NextResponse.json({ ok: true });
      }
    }
  } catch (error) {
    console.error("Gallery upload action failed:", error);
    return NextResponse.json(
      { error: "Storage hiccup. The uploader will retry." },
      { status: 502 },
    );
  }
}
