/**
 * Print-file renderer — DESIGNER_SPEC.md Phase D1.
 *
 * Renders every spread of an album to Miller's-spec raster files:
 * full-spread JPEGs (page width × 2) at 250 DPI, no bleed. The pixels come
 * from Puppeteer screenshotting /print/spread/[id] — the same SpreadRenderer
 * that draws every preview — so preview and print are the same rasterizer's
 * output by construction. page.screenshot() is used (never page.pdf(), which
 * ignores deviceScaleFactor).
 *
 * Usage:
 *   node scripts/render-print.mjs <albumId> [--size 12x12] [--out <dir>] [--base http://localhost:3000]
 *
 * Requires .env.local (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
 * PRINT_RENDER_TOKEN) and the dev server (or any deployment) running at --base.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createClient } from "@supabase/supabase-js";
import puppeteer from "puppeteer";
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

const args = process.argv.slice(2);
const albumId = args[0];
if (!albumId) {
  console.error("Usage: node scripts/render-print.mjs <albumId> [--size 12x12] [--out dir] [--base url]");
  process.exit(1);
}
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i !== -1 && args[i + 1] ? args[i + 1] : fallback;
};
const sizeOverride = flag("size", null);
const base = flag("base", "http://localhost:3000");
const outDir = flag(
  "out",
  path.join(repoRoot, ".print-out", albumId + (sizeOverride ? `-${sizeOverride}` : "")),
);
const token = env.PRINT_RENDER_TOKEN;
if (!token) {
  console.error("PRINT_RENDER_TOKEN missing from .env.local");
  process.exit(1);
}

const PRINT_DPI = 250;
const PAGE_INCHES = {
  "10x10": [10, 10],
  "12x12": [12, 12],
  "11x14": [11, 14],
  "8x8": [8, 8],
};

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const { data: album, error: albumError } = await admin
  .from("albums")
  .select("id, title, size")
  .eq("id", albumId)
  .maybeSingle();
if (albumError || !album) {
  console.error("Album not found:", albumError?.message ?? albumId);
  process.exit(1);
}
const size = sizeOverride ?? album.size;
const inches = PAGE_INCHES[size];
if (!inches) {
  console.error("Unknown size:", size);
  process.exit(1);
}
const width = inches[0] * 2 * PRINT_DPI;
const height = inches[1] * PRINT_DPI;

const { data: spreads, error: spreadsError } = await admin
  .from("spreads")
  .select("id, position")
  .eq("album_id", albumId)
  .order("position", { ascending: true });
if (spreadsError || !spreads?.length) {
  console.error("No spreads:", spreadsError?.message ?? "album has no spread rows");
  process.exit(1);
}

fs.mkdirSync(outDir, { recursive: true });
console.log(`${album.title} — ${spreads.length} spreads at ${size} → ${width}×${height}px @ ${PRINT_DPI} DPI`);

const browser = await puppeteer.launch({
  headless: true,
  args: ["--no-sandbox", "--force-color-profile=srgb", "--hide-scrollbars"],
});

try {
  const page = await browser.newPage();
  await page.setViewport({ width, height, deviceScaleFactor: 1 });

  for (const spread of spreads) {
    const url = `${base}/print/spread/${spread.id}?token=${token}${sizeOverride ? `&size=${sizeOverride}` : ""}`;
    const started = Date.now();
    const response = await page.goto(url, { waitUntil: "networkidle0", timeout: 180000 });
    if (!response?.ok()) {
      throw new Error(`Spread ${spread.position}: HTTP ${response?.status()} from print route`);
    }
    // Every image decoded at natural size, every font loaded — then shoot.
    await page.waitForFunction(
      () =>
        document.fonts.status === "loaded" &&
        document.images.length > 0 &&
        [...document.images].every((i) => i.complete && i.naturalWidth > 0),
      { timeout: 120000 },
    );

    const png = await page.screenshot({ type: "png" });
    // Re-encode once through sharp: JPEG quality 95, 4:4:4 chroma (no
    // subsampling artifacts on fine detail), density tag 250 DPI for the lab.
    const file = path.join(outDir, `spread-${String(spread.position).padStart(2, "0")}.jpg`);
    await sharp(png)
      .jpeg({ quality: 95, chromaSubsampling: "4:4:4" })
      .withMetadata({ density: PRINT_DPI })
      .toFile(file);

    const meta = await sharp(file).metadata();
    const ok = meta.width === width && meta.height === height && meta.density === PRINT_DPI;
    console.log(
      `spread ${spread.position}: ${meta.width}×${meta.height} @ ${meta.density} DPI, ${(fs.statSync(file).size / 1024 / 1024).toFixed(1)}MB, ${((Date.now() - started) / 1000).toFixed(1)}s ${ok ? "OK" : "** DIMENSION MISMATCH **"}`,
    );
    if (!ok) process.exitCode = 1;
  }
} finally {
  await browser.close();
}
console.log(`Done → ${outDir}`);
