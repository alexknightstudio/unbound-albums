/**
 * Thumbnail rules. Pure — no sharp import, so the UI and tests can use it too.
 */

/** Long edge in pixels. Big enough for the editor's filmstrip on a retina phone. */
export const THUMB_LONG_EDGE = 600;

export const THUMB_QUALITY = 80;

export type Orientation = "portrait" | "landscape" | "square";

/**
 * Classify by the pixels a viewer actually sees — measure AFTER any EXIF
 * rotation has been applied, or every sideways phone photo lands in the wrong
 * bucket and the layout engine builds spreads around a lie.
 */
export function orientationFor(width: number, height: number): Orientation {
  if (width > height) return "landscape";
  if (height > width) return "portrait";
  return "square";
}
