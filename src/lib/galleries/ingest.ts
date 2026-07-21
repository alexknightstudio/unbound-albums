import { encode } from "blurhash";
import sharp from "sharp";

/**
 * Ingest metadata (PLATFORM_SPEC §9) — everything the display system needs,
 * computed once when a photo lands:
 *   width/height — the justified layout solves row heights from aspect ratios
 *                  BEFORE any image loads, so these are not optional
 *   blurhash     — a ~30-byte string that paints instantly, killing layout
 *                  shift and the grey-box feeling on slow connections
 *   takenAt      — EXIF capture time; chronological order and Smart Arrange
 *
 * Pure-ish: takes bytes, returns data. No DB, no network.
 */

export type IngestMetadata = {
  width: number;
  height: number;
  blurhash: string | null;
  takenAt: string | null;
};

/** EXIF DateTimeOriginal is "YYYY:MM:DD HH:MM:SS" — not ISO, needs coaxing. */
function parseExifDate(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const match = value.match(
    /^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/,
  );
  if (!match) return null;
  const [, y, mo, d, h, mi, s] = match;
  const date = new Date(`${y}-${mo}-${d}T${h}:${mi}:${s}Z`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export async function readIngestMetadata(
  original: Buffer,
): Promise<IngestMetadata> {
  const image = sharp(original).rotate(); // honor EXIF orientation
  const meta = await image.metadata();

  // Orientation 5–8 swap the axes; sharp's metadata reports pre-rotation dims.
  const swapped = (meta.orientation ?? 1) >= 5;
  const width = (swapped ? meta.height : meta.width) ?? 0;
  const height = (swapped ? meta.width : meta.height) ?? 0;

  let blurhash: string | null = null;
  try {
    // 32px longest edge is plenty — blurhash only encodes low frequencies.
    const { data, info } = await image
      .clone()
      .resize(32, 32, { fit: "inside" })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    blurhash = encode(
      new Uint8ClampedArray(data),
      info.width,
      info.height,
      4,
      3,
    );
  } catch {
    // A missing placeholder is cosmetic; never fail an upload over it.
    blurhash = null;
  }

  let takenAt: string | null = null;
  try {
    if (meta.exif) {
      // sharp gives the raw EXIF block; pull DateTimeOriginal without a parser
      // dependency — the tag's ASCII value is findable directly.
      const text = meta.exif.toString("latin1");
      const match = text.match(/(\d{4}:\d{2}:\d{2} \d{2}:\d{2}:\d{2})/);
      takenAt = parseExifDate(match?.[1]);
    }
  } catch {
    takenAt = null;
  }

  return { width, height, blurhash, takenAt };
}
