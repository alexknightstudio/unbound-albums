import { describe, expect, it } from "vitest";

import { ALBUM_SIZE_SPECS, ALBUM_SIZES } from "../albums/sizes";

import { SPREAD_TEMPLATES, isFullBleed, type SlotRect } from "./templates";

/** Geometry contract for every template. These rules are what make one
 * renderer able to draw all 23 templates safely at print. */

function overlaps(a: SlotRect, b: SlotRect): boolean {
  return (
    a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h
  );
}

// Safe margin from trim edges for non-full-bleed slots. 0.025 of the spread
// width on a 10×10 is 0.5" horizontally; 0.05 of the height is 0.5"
// vertically — the Miller's "keep important elements 3/8–1/2 inch from the
// edge" rule expressed in canvas fractions.
const MARGIN_X = 0.025;
const MARGIN_Y = 0.05;

describe("template geometry", () => {
  for (const template of SPREAD_TEMPLATES) {
    describe(template.code, () => {
      it("keeps every rect inside the canvas", () => {
        for (const slot of template.slots) {
          const { x, y, w, h } = slot.rect;
          expect(x).toBeGreaterThanOrEqual(0);
          expect(y).toBeGreaterThanOrEqual(0);
          expect(w).toBeGreaterThan(0);
          expect(h).toBeGreaterThan(0);
          expect(x + w).toBeLessThanOrEqual(1.000001);
          expect(y + h).toBeLessThanOrEqual(1.000001);
        }
      });

      it("keeps non-full-bleed slots off the trim edges", () => {
        for (const slot of template.slots) {
          if (isFullBleed(slot.rect)) continue;
          const { x, y, w, h } = slot.rect;
          expect(x).toBeGreaterThanOrEqual(MARGIN_X);
          expect(1 - (x + w)).toBeGreaterThanOrEqual(MARGIN_X - 1e-9);
          expect(y).toBeGreaterThanOrEqual(MARGIN_Y);
          expect(1 - (y + h)).toBeGreaterThanOrEqual(MARGIN_Y - 1e-9);
        }
      });

      it("has no overlapping slots", () => {
        const slots = template.slots;
        for (let i = 0; i < slots.length; i++) {
          for (let j = i + 1; j < slots.length; j++) {
            expect(
              overlaps(slots[i].rect, slots[j].rect),
              `${slots[i].id} overlaps ${slots[j].id}`,
            ).toBe(false);
          }
        }
      });

      it("gives orientation-constrained slots a matching aspect at every album size", () => {
        for (const size of ALBUM_SIZES) {
          const spec = ALBUM_SIZE_SPECS[size];
          const spreadW = spec.pageWidthIn * 2;
          const spreadH = spec.pageHeightIn;
          for (const slot of template.slots) {
            const wIn = slot.rect.w * spreadW;
            const hIn = slot.rect.h * spreadH;
            if (slot.accepts === "portrait") {
              expect(
                hIn,
                `${template.code}.${slot.id} at ${size} is ${wIn.toFixed(1)}x${hIn.toFixed(1)}`,
              ).toBeGreaterThan(wIn);
            }
            if (slot.accepts === "landscape") {
              expect(
                wIn,
                `${template.code}.${slot.id} at ${size} is ${wIn.toFixed(1)}x${hIn.toFixed(1)}`,
              ).toBeGreaterThanOrEqual(hIn * 0.95); // full-page slots may crop landscape near-square
            }
          }
        }
      });
    });
  }

  it("only panoramas, grids, and full-spread slots cross the center fold", () => {
    // The fold is physical. Small floated slots must not straddle it; wide
    // deliberate panoramas, grid rows, and full-bleed spreads may.
    const allowedToCross = new Set([
      "H1.hero",
      "T3.center",
      "T4.feature",
      "M5.feature",
      "M6.grid_2",
      "M6.grid_5",
    ]);
    for (const template of SPREAD_TEMPLATES) {
      for (const slot of template.slots) {
        const { x, w } = slot.rect;
        const crosses = x < 0.5 && x + w > 0.5;
        if (crosses) {
          expect(
            allowedToCross.has(`${template.code}.${slot.id}`),
            `${template.code}.${slot.id} straddles the fold`,
          ).toBe(true);
        }
      }
    }
  });
});
