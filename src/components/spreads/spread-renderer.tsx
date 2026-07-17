/* eslint-disable @next/next/no-img-element */
/**
 * Draws any spread template at any size. THE render path: the album preview,
 * the share page, and (Phase 5) the 300-DPI print PDF all draw through this
 * component — that identity is the WYSIWYG guarantee from CLAUDE.md.
 *
 * Geometry comes from the template's slot rects (fractions of the spread
 * canvas). Photos fill their slot with object-fit: cover, centered — the
 * classic album crop.
 */

import { TEMPLATES_BY_CODE } from "@/lib/engine/templates";

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
  showFold = false,
  className,
}: {
  templateCode: string;
  /** { slot_id: photo_id } exactly as the database stores it. */
  slots: Record<string, string>;
  photosById: ReadonlyMap<string, SpreadPhoto>;
  sizeSpec: AlbumSizeSpec;
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
        const { x, y, w, h } = slot.rect;
        return (
          <div
            key={slot.id}
            className="absolute overflow-hidden"
            style={{
              left: `${x * 100}%`,
              top: `${y * 100}%`,
              width: `${w * 100}%`,
              height: `${h * 100}%`,
            }}
          >
            {photo ? (
              <img
                src={photo.url}
                alt=""
                className="h-full w-full object-cover"
                draggable={false}
              />
            ) : (
              // An empty slot should read as deliberate whitespace failure,
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
