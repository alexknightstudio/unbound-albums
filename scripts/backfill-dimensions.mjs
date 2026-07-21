/**
 * Backfill display metadata for photos uploaded before P2 (PLATFORM_SPEC §13
 * risk 6: any photo missing width/height breaks the justified layout).
 *
 *   node scripts/backfill-dimensions.mjs [--force]
 *
 * Pulls each original from R2 (egress is free), computes width/height/
 * blurhash/taken_at with the same code the ingest path uses, and writes them
 * back. Idempotent: skips rows that already have dimensions unless --force.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { createClient } from "@supabase/supabase-js";
import { encode } from "blurhash";
import sharp from "sharp";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const env = Object.fromEntries(
  fs
    .readFileSync(path.join(repoRoot, ".env.local"), "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
);

const force = process.argv.includes("--force");

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  forcePathStyle: true,
  credentials: {
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
  },
});

const { data: photos, error } = await admin
  .from("gallery_photos")
  .select("id, r2_key, width, height, blurhash")
  .order("created_at");
if (error) {
  console.error(error.message);
  process.exit(1);
}

const todo = photos.filter((p) => force || !p.width || !p.height || !p.blurhash);
console.log(`${photos.length} photos, ${todo.length} need backfill`);

for (const photo of todo) {
  try {
    const res = await r2.send(
      new GetObjectCommand({ Bucket: env.R2_BUCKET, Key: photo.r2_key }),
    );
    const original = Buffer.from(await res.Body.transformToByteArray());

    const image = sharp(original).rotate();
    const meta = await image.metadata();
    const swapped = (meta.orientation ?? 1) >= 5;
    const width = (swapped ? meta.height : meta.width) ?? 0;
    const height = (swapped ? meta.width : meta.height) ?? 0;

    const { data, info } = await image
      .clone()
      .resize(32, 32, { fit: "inside" })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const blurhash = encode(new Uint8ClampedArray(data), info.width, info.height, 4, 3);

    let takenAt = null;
    if (meta.exif) {
      const m = meta.exif.toString("latin1").match(/(\d{4}):(\d{2}):(\d{2}) (\d{2}:\d{2}:\d{2})/);
      if (m) {
        const d = new Date(`${m[1]}-${m[2]}-${m[3]}T${m[4]}Z`);
        if (!Number.isNaN(d.getTime())) takenAt = d.toISOString();
      }
    }

    await admin
      .from("gallery_photos")
      .update({ width, height, blurhash, taken_at: takenAt })
      .eq("id", photo.id);
    console.log(`${photo.id.slice(0, 8)} ${width}×${height} ${takenAt ?? "no EXIF date"}`);
  } catch (e) {
    console.error(`${photo.id.slice(0, 8)} FAILED: ${e.message}`);
    process.exitCode = 1;
  }
}
console.log("Done.");
