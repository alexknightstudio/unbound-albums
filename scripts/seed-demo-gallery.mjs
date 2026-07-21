/**
 * Seed a demo gallery with REAL, properly licensed photography from Wikimedia
 * Commons (CC / public domain), complete with attribution.
 *
 *   node scripts/seed-demo-gallery.mjs "Amalfi Coast" "italy coast amalfi positano landscape" 10 public
 *   node scripts/seed-demo-gallery.mjs "Wedding Day" "wedding ceremony bride groom photography" 12 unlisted
 *
 * Args: <title> <commons search terms> [count] [visibility]
 *
 * Every photo keeps its author + license in gallery_photos.credit, which the
 * gallery page renders. Never scrape unlicensed images into this product.
 */

import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";

import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
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

const [title, search, countRaw, visibilityRaw] = process.argv.slice(2);
if (!title || !search) {
  console.error('Usage: node scripts/seed-demo-gallery.mjs "<title>" "<search terms>" [count] [visibility]');
  process.exit(1);
}
const count = Number(countRaw ?? 10);
const visibility = visibilityRaw ?? "public";
// --portrait keeps only vertical frames: most people shoot on a phone, so a
// demo full of landscapes quietly says "this product is for DSLR owners".
const portraitOnly = process.argv.includes("--portrait");

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

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Wikimedia asks for serial, throttled requests. Be a good citizen. */
async function politeFetch(url, attempt = 1) {
  const res = await fetch(url, {
    headers: { "User-Agent": "UnboundAlbums/1.0 (demo gallery seeding; alex@alexknightstudio.com)" },
  });
  if (res.status === 429 && attempt <= 4) {
    const wait = attempt * 4000;
    console.log(`    rate-limited, waiting ${wait / 1000}s…`);
    await sleep(wait);
    return politeFetch(url, attempt + 1);
  }
  return res;
}

// Commons is full of scanned paintings and engravings — fine art, wrong
// signal for a product about photographs people took.
const ARTWORK = /painting|oil on canvas|engrav|watercolou?r|lithograph|etching|drawing|sketch|woodcut|illustration|\b1[6-8]\d{2}\b|\b18\d{2}-1[89]\d{2}\b/i;
const looksLikeArtwork = (title, author) =>
  ARTWORK.test(title) || ARTWORK.test(author);

const strip = (html) =>
  String(html ?? "")
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);

// 1. Find candidates on Commons. Its search prefers SHORT queries, so terms
// are pipe-separated and pooled: "Positano|Amalfi coast|Capri".
const terms = search.split("|").map((t) => t.trim()).filter(Boolean);
const pages = [];
for (const term of terms) {
  const api = new URL("https://commons.wikimedia.org/w/api.php");
  api.search = new URLSearchParams({
    action: "query",
    generator: "search",
    gsrsearch: `filetype:bitmap ${term}`,
    gsrlimit: String(Math.max(6, Math.ceil((count * 2) / terms.length))),
    gsrnamespace: "6",
    prop: "imageinfo",
    iiprop: "url|extmetadata|size|mime",
    iiurlwidth: "2400",
    format: "json",
  }).toString();
  const res = await politeFetch(api);
  const json = await res.json();
  pages.push(...Object.values(json?.query?.pages ?? {}));
  await sleep(600);
}

const candidates = pages
  .map((p) => {
    const ii = p.imageinfo?.[0];
    if (!ii) return null;
    const md = ii.extmetadata ?? {};
    return {
      title: p.title,
      url: ii.thumburl ?? ii.url,
      width: ii.thumbwidth ?? ii.width,
      height: ii.thumbheight ?? ii.height,
      mime: ii.mime,
      author: strip(md.Artist?.value) || "Unknown",
      license: strip(md.LicenseShortName?.value) || "See Commons",
      descUrl: ii.descriptionurl,
    };
  })
  .filter(
    (c) =>
      c &&
      c.mime === "image/jpeg" &&
      !looksLikeArtwork(c.title, c.author) &&
      (portraitOnly
        ? c.height > c.width * 1.15 && c.width >= 800
        : c.width >= 1200 && c.height >= 800) &&
      // Skip absurd panoramas and slivers — they wreck a justified row.
      c.width / c.height < 3 &&
      c.height / c.width < 2.4,
  );

// Interleave so a row never shows six frames of the same subject.
const seen = new Set();
const picked = [];
for (const c of candidates) {
  if (seen.has(c.url)) continue;
  seen.add(c.url);
  picked.push(c);
  if (picked.length >= count) break;
}

if (picked.length === 0) {
  console.error("No suitable photos found for that search.");
  process.exit(1);
}
console.log(`${picked.length} licensed photos found for "${search}"`);

// 2. The gallery belongs to the single existing account.
const { data: account } = await admin.from("accounts").select("user_id").limit(1).single();

const { data: gallery, error: galleryError } = await admin
  .from("galleries")
  .insert({
    owner_id: account.user_id,
    title,
    slug: randomUUID().replaceAll("-", ""),
    visibility,
    indexed_at: visibility === "public" ? new Date().toISOString() : null,
  })
  .select("id, slug")
  .single();
if (galleryError) {
  console.error(galleryError.message);
  process.exit(1);
}

// 3. Download → R2 (original + thumb) → row with dimensions, blurhash, credit.
let position = 0;
for (const photo of picked) {
  try {
    const imgRes = await politeFetch(photo.url);
    if (!imgRes.ok) throw new Error(`HTTP ${imgRes.status}`);
    const original = Buffer.from(await imgRes.arrayBuffer());

    const photoId = randomUUID();
    const originalKey = `g/${gallery.id}/o/${photoId}.jpg`;
    const thumbKey = `g/${gallery.id}/t/${photoId}.jpg`;

    const image = sharp(original).rotate();
    const meta = await image.metadata();
    const thumb = await image
      .clone()
      .resize(1600, 1600, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 82 })
      .toBuffer();

    const { data: raw, info } = await image
      .clone()
      .resize(32, 32, { fit: "inside" })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const blurhash = encode(new Uint8ClampedArray(raw), info.width, info.height, 4, 3);

    await r2.send(
      new PutObjectCommand({
        Bucket: env.R2_BUCKET,
        Key: originalKey,
        Body: original,
        ContentType: "image/jpeg",
      }),
    );
    await r2.send(
      new PutObjectCommand({
        Bucket: env.R2_BUCKET,
        Key: thumbKey,
        Body: thumb,
        ContentType: "image/jpeg",
      }),
    );

    position += 1;
    await admin.from("gallery_photos").insert({
      id: photoId,
      gallery_id: gallery.id,
      r2_key: originalKey,
      thumb_key: thumbKey,
      filename: photo.title.replace(/^File:/, ""),
      size_bytes: original.length,
      width: meta.width,
      height: meta.height,
      blurhash,
      credit: `${photo.author} · ${photo.license}`,
      position,
    });
    console.log(`  ${position}. ${meta.width}×${meta.height} — ${photo.author} (${photo.license})`);
    await sleep(1200); // throttle between downloads
  } catch (e) {
    console.error(`  skipped ${photo.title}: ${e.message}`);
  }
}

console.log(`\n"${title}" → /g/${gallery.slug} (${visibility}, ${position} photos)`);
