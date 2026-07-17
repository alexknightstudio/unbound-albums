/* eslint-disable @next/next/no-img-element */
/**
 * Draws any spread template at any size. THE render path: the album preview,
 * the share page, the editor, and (Phase 5) the 300-DPI print PDF all draw
 * through this component — that identity is the WYSIWYG guarantee from
 * CLAUDE.md.
 *
 * Geometry comes from the template's slot rects (fractions of the spread
 * canvas), optionally mirrored when the spread is flipped — the photos
 * themselves are never mirrored. Photos fill their slot with object-fit:
 * cover; per-slot crops (object-position percentages) reframe what shows.
 */

import {
  TEMPLATES_BY_CODE,
  mirroredRect,
  type SlotCrop,
} from "@/lib/engine/templates";

import type { AlbumSizeSpec } from "@/lib/albums/sizes";

export type SpreadPhoto = {
  /** Where to load the image from (signed URL). */
  url: string;
};

export function SpreadRenderer({
  templateCode,
  slots,
  photosById,
  sizeSpec,
  crops,
  flipped = false,
  showFold = false,
  className,
}: {
  templateCode: string;
  /** { slot_id: photo_id } exactly as the database stores it. */
  slots: Record<string, string>;
  photosById: ReadonlyMap<string, SpreadPhoto>;
  sizeSpec: AlbumSizeSpec;
  /** { slot_id: {x, y} } object-position percentages; absent = centered. */
  crops?: Record<string, SlotCrop>;
  /** Mirror the slot geometry across the fold. */
  flipped?: boolean;
  /** Draw a hairline at the center fold — preview only, never print. */
  showFold?: boolean;
  className?: string;
}) {
  const template = TEMPLATES_BY_CODE.get(templateCode);
  if (!template) return null;

  const aspect = (sizeSpec.pageWidthIn * 2) / sizeSpec.pageHeightIn;

  return (
    <div
      className={`relative w-full overflow-hidden bg-white ${className ?? ""}`}
      style={{ aspectRatio: `${aspect}` }}
    >
      {template.slots.map((slot) => {
        const photoId = slots[slot.id];
        const photo = photoId ? photosById.get(photoId) : undefined;
        const rect = flipped ? mirroredRect(slot.rect) : slot.rect;
        const crop = crops?.[slot.id];
        return (
          <div
            key={slot.id}
            className="absolute overflow-hidden"
            style={{
              left: `${rect.x * 100}%`,
              top: `${rect.y * 100}%`,
              width: `${rect.w * 100}%`,
              height: `${rect.h * 100}%`,
            }}
          >
            {photo ? (
              <img
                src={photo.url}
                alt=""
                className="h-full w-full object-cover"
                style={
                  crop
                    ? { objectPosition: `${crop.x}% ${crop.y}%` }
                    : undefined
                }
                draggable={false}
              />
            ) : (
              // An empty slot should read as deliberate whitespace,
              // not a broken image: quiet grey, no icon.
              <div className="h-full w-full bg-linen" />
            )}
          </div>
        );
      })}

      {showFold ? (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 left-1/2 w-px -translate-x-px bg-ink/10"
        />
      ) : null}
    </div>
  );
}
