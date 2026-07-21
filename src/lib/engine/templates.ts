/**
 * The spread template contract.
 *
 * 23 templates: Hero H1–H3, Duo D1–D5, Trio T1–T5, Multi M1–M7, Detail
 * DT1–DT3 — the same set the database check constraint enforces on
 * spreads.template_code.
 *
 * A template is GEOMETRY DATA, not a component. Each slot carries a rect in
 * fractions of the full spread canvas (two pages side by side; the center
 * fold sits at x = 0.5). One renderer component draws every template, and the
 * print PDF draws through the same path — that identity is the WYSIWYG
 * guarantee. Photos fill their slot with object-fit: cover.
 *
 * Geometry rules (Miller's/Bay specs, docs/album-market-research-2026-07.md):
 * - Full-bleed rects (0,0,1,1 or a full page) are allowed; the book lies flat.
 * - Non-full-bleed slots keep clear of the trim edges (≥ ~3% of the canvas,
 *   ≈ 0.5" on a 10×10) and, except for deliberate panoramas and grids, avoid
 *   straddling the center fold.
 * - The layout prompt keeps faces off the fold; geometry keeps small slots
 *   out of it entirely where the design allows.
 *
 * Pure data. The engine, the prompts, the renderer, and the tests all read
 * from here — one source of truth for the contract.
 */

/** Photo orientation — engine-local; the engine imports nothing outside itself. */
export type Orientation = "portrait" | "landscape" | "square";

export type SlotAccepts = Orientation | "any";

/** Fractions of the spread canvas. x/w are fractions of the full spread
 * width (two pages); y/h are fractions of the page height. */
export type SlotRect = {
  x: number;
  y: number;
  w: number;
  h: number;
};

export type TemplateSlot = {
  id: string;
  /** Hard constraint. "any" fits every photo; a specific orientation only
   * accepts that orientation (squares also fit portrait/landscape slots —
   * see slotAcceptsPhoto). */
  accepts: SlotAccepts;
  /** The visually dominant slot, when the template has one. The engine puts
   * the strongest photo here. */
  emphasis?: boolean;
  rect: SlotRect;
};

export type SpreadTemplate = {
  code: string;
  /** The name a couple sees — warm, concrete, no codes. */
  name: string;
  /** One-line description — rendered into the layout prompt so the model
   * knows what it's choosing. */
  description: string;
  slots: readonly TemplateSlot[];
};

export const SPREAD_TEMPLATES: readonly SpreadTemplate[] = [
  // --- Hero: one photo carries the whole spread -------------------------
  {
    code: "H1",
    name: "The full spread",
    description:
      "Full-bleed landscape hero across both pages. The single most impactful treatment — reserve for the strongest wide images. Subject must sit clearly left or right of the center fold.",
    slots: [
      {
        id: "hero",
        accepts: "landscape",
        emphasis: true,
        rect: { x: 0, y: 0, w: 1, h: 1 },
      },
    ],
  },
  {
    code: "H2",
    name: "The portrait, alone",
    description:
      "Portrait hero on the right page with an empty left page. Editorial and quiet.",
    slots: [
      {
        id: "hero",
        accepts: "portrait",
        emphasis: true,
        rect: { x: 0.62, y: 0.1, w: 0.26, h: 0.8 },
      },
    ],
  },
  {
    code: "H3",
    name: "The gallery wall",
    description:
      "One photo of any orientation floated on the left page with wide margins, right page empty. Formal and gallery-like.",
    slots: [
      {
        id: "hero",
        accepts: "any",
        emphasis: true,
        rect: { x: 0.1, y: 0.15, w: 0.3, h: 0.7 },
      },
    ],
  },

  // --- Duo: two photos in conversation ---------------------------------
  {
    code: "D1",
    name: "Side by side",
    description: "Two portraits, one per page. A classic pairing spread.",
    slots: [
      {
        id: "left",
        accepts: "portrait",
        rect: { x: 0.1, y: 0.1, w: 0.3, h: 0.8 },
      },
      {
        id: "right",
        accepts: "portrait",
        rect: { x: 0.6, y: 0.1, w: 0.3, h: 0.8 },
      },
    ],
  },
  {
    code: "D2",
    name: "Two views",
    description: "Two landscapes, one centered on each page.",
    slots: [
      {
        id: "left",
        accepts: "landscape",
        rect: { x: 0.06, y: 0.22, w: 0.38, h: 0.56 },
      },
      {
        id: "right",
        accepts: "landscape",
        rect: { x: 0.56, y: 0.22, w: 0.38, h: 0.56 },
      },
    ],
  },
  {
    code: "D3",
    name: "Full page & companion",
    description:
      "Full-bleed image filling the left page, smaller portrait floated on the right.",
    slots: [
      {
        id: "feature",
        // Page-shaped: near-square on square books, portrait on 11x14. Any
        // orientation may fill it; the crop is the treatment.
        accepts: "any",
        emphasis: true,
        rect: { x: 0, y: 0, w: 0.5, h: 1 },
      },
      {
        id: "companion",
        accepts: "portrait",
        rect: { x: 0.62, y: 0.2, w: 0.24, h: 0.6 },
      },
    ],
  },
  {
    code: "D4",
    name: "Portrait & landscape",
    description:
      "Large portrait on the left page, landscape centered on the right.",
    slots: [
      {
        id: "feature",
        accepts: "portrait",
        emphasis: true,
        rect: { x: 0.08, y: 0.08, w: 0.32, h: 0.84 },
      },
      {
        id: "companion",
        accepts: "landscape",
        rect: { x: 0.55, y: 0.3, w: 0.4, h: 0.4 },
      },
    ],
  },
  {
    code: "D5",
    name: "The quiet pair",
    description:
      "Two photos of any orientation, small and centered with generous whitespace. Quietest duo.",
    slots: [
      {
        id: "left",
        accepts: "any",
        rect: { x: 0.14, y: 0.3, w: 0.22, h: 0.4 },
      },
      {
        id: "right",
        accepts: "any",
        rect: { x: 0.64, y: 0.3, w: 0.22, h: 0.4 },
      },
    ],
  },

  // --- Trio: three photos, one usually leading -------------------------
  {
    code: "T1",
    name: "One leads, two follow",
    description:
      "Image filling the left page; two photos stacked on the right.",
    slots: [
      {
        id: "feature",
        // Page-shaped: near-square on square books, portrait on 11x14. Any
        // orientation may fill it; the crop is the treatment.
        accepts: "any",
        emphasis: true,
        rect: { x: 0, y: 0, w: 0.5, h: 1 },
      },
      {
        id: "stack_top",
        accepts: "any",
        rect: { x: 0.58, y: 0.08, w: 0.34, h: 0.4 },
      },
      {
        id: "stack_bottom",
        accepts: "any",
        rect: { x: 0.58, y: 0.52, w: 0.34, h: 0.4 },
      },
    ],
  },
  {
    code: "T2",
    name: "Portrait with moments",
    description:
      "Portrait feature on the left page; two landscapes stacked on the right.",
    slots: [
      {
        id: "feature",
        accepts: "portrait",
        emphasis: true,
        rect: { x: 0.1, y: 0.08, w: 0.3, h: 0.84 },
      },
      {
        id: "stack_top",
        accepts: "landscape",
        rect: { x: 0.55, y: 0.1, w: 0.4, h: 0.36 },
      },
      {
        id: "stack_bottom",
        accepts: "landscape",
        rect: { x: 0.55, y: 0.54, w: 0.4, h: 0.36 },
      },
    ],
  },
  {
    code: "T3",
    name: "Three in a row",
    description:
      "Three portraits in a row across the spread. Rhythmic; great for a sequence. The center photo crosses the fold — keep faces out of its middle.",
    slots: [
      {
        id: "left",
        accepts: "portrait",
        rect: { x: 0.075, y: 0.225, w: 0.25, h: 0.55 },
      },
      {
        id: "center",
        accepts: "portrait",
        rect: { x: 0.375, y: 0.225, w: 0.25, h: 0.55 },
      },
      {
        id: "right",
        accepts: "portrait",
        rect: { x: 0.675, y: 0.225, w: 0.25, h: 0.55 },
      },
    ],
  },
  {
    code: "T4",
    name: "The panorama",
    description:
      "Wide panorama across the top of the spread; two photos side by side below.",
    slots: [
      {
        id: "feature",
        accepts: "landscape",
        emphasis: true,
        rect: { x: 0.06, y: 0.07, w: 0.88, h: 0.48 },
      },
      {
        id: "below_left",
        accepts: "any",
        rect: { x: 0.14, y: 0.62, w: 0.3, h: 0.3 },
      },
      {
        id: "below_right",
        accepts: "any",
        rect: { x: 0.56, y: 0.62, w: 0.3, h: 0.3 },
      },
    ],
  },
  {
    code: "T5",
    name: "Loosely gathered",
    description:
      "Loose asymmetric arrangement of three photos of any orientation.",
    slots: [
      {
        id: "first",
        accepts: "any",
        emphasis: true,
        rect: { x: 0.06, y: 0.1, w: 0.4, h: 0.62 },
      },
      {
        id: "second",
        accepts: "any",
        rect: { x: 0.56, y: 0.16, w: 0.26, h: 0.36 },
      },
      {
        id: "third",
        accepts: "any",
        rect: { x: 0.6, y: 0.58, w: 0.3, h: 0.32 },
      },
    ],
  },

  // --- Multi: four to six photos, momentum spreads ----------------------
  {
    code: "M1",
    name: "Four square",
    description: "Four photos in a clean 2×2 grid.",
    slots: [
      {
        id: "top_left",
        accepts: "any",
        rect: { x: 0.055, y: 0.075, w: 0.42, h: 0.4 },
      },
      {
        id: "top_right",
        accepts: "any",
        rect: { x: 0.525, y: 0.075, w: 0.42, h: 0.4 },
      },
      {
        id: "bottom_left",
        accepts: "any",
        rect: { x: 0.055, y: 0.525, w: 0.42, h: 0.4 },
      },
      {
        id: "bottom_right",
        accepts: "any",
        rect: { x: 0.525, y: 0.525, w: 0.42, h: 0.4 },
      },
    ],
  },
  {
    code: "M2",
    name: "Full page & three",
    description:
      "Image filling the left page; three photos in a column on the right.",
    slots: [
      {
        id: "feature",
        // Page-shaped: near-square on square books, portrait on 11x14. Any
        // orientation may fill it; the crop is the treatment.
        accepts: "any",
        emphasis: true,
        rect: { x: 0, y: 0, w: 0.5, h: 1 },
      },
      {
        id: "first",
        accepts: "any",
        rect: { x: 0.56, y: 0.06, w: 0.36, h: 0.26 },
      },
      {
        id: "second",
        accepts: "any",
        rect: { x: 0.56, y: 0.37, w: 0.36, h: 0.26 },
      },
      {
        id: "third",
        accepts: "any",
        rect: { x: 0.56, y: 0.68, w: 0.36, h: 0.26 },
      },
    ],
  },
  {
    code: "M3",
    name: "Three & a portrait",
    description:
      "Portrait feature on the right page; three photos stacked on the left.",
    slots: [
      {
        id: "feature",
        accepts: "portrait",
        emphasis: true,
        rect: { x: 0.6, y: 0.08, w: 0.3, h: 0.84 },
      },
      {
        id: "first",
        accepts: "any",
        rect: { x: 0.08, y: 0.06, w: 0.34, h: 0.26 },
      },
      {
        id: "second",
        accepts: "any",
        rect: { x: 0.08, y: 0.37, w: 0.34, h: 0.26 },
      },
      {
        id: "third",
        accepts: "any",
        rect: { x: 0.08, y: 0.68, w: 0.34, h: 0.26 },
      },
    ],
  },
  {
    code: "M4",
    name: "The anchor",
    description:
      "Five photos: one large anchor on the left page plus four smaller on the right. Reception energy.",
    slots: [
      {
        id: "anchor",
        accepts: "any",
        emphasis: true,
        rect: { x: 0.06, y: 0.1, w: 0.38, h: 0.8 },
      },
      {
        id: "first",
        accepts: "any",
        rect: { x: 0.54, y: 0.1, w: 0.2, h: 0.375 },
      },
      {
        id: "second",
        accepts: "any",
        rect: { x: 0.76, y: 0.1, w: 0.2, h: 0.375 },
      },
      {
        id: "third",
        accepts: "any",
        rect: { x: 0.54, y: 0.525, w: 0.2, h: 0.375 },
      },
      {
        id: "fourth",
        accepts: "any",
        rect: { x: 0.76, y: 0.525, w: 0.2, h: 0.375 },
      },
    ],
  },
  {
    code: "M5",
    name: "Panorama & filmstrip",
    description:
      "Wide panorama on top plus a four-photo filmstrip row below.",
    slots: [
      {
        id: "feature",
        accepts: "landscape",
        emphasis: true,
        rect: { x: 0.06, y: 0.07, w: 0.88, h: 0.5 },
      },
      {
        id: "strip_1",
        accepts: "any",
        rect: { x: 0.06, y: 0.64, w: 0.2, h: 0.28 },
      },
      {
        id: "strip_2",
        accepts: "any",
        rect: { x: 0.29, y: 0.64, w: 0.2, h: 0.28 },
      },
      {
        id: "strip_3",
        accepts: "any",
        rect: { x: 0.52, y: 0.64, w: 0.2, h: 0.28 },
      },
      {
        id: "strip_4",
        accepts: "any",
        rect: { x: 0.75, y: 0.64, w: 0.2, h: 0.28 },
      },
    ],
  },
  {
    code: "M6",
    name: "Six candids",
    description: "Six photos in a 3×2 grid. Candid momentum; dance floor.",
    slots: [
      {
        id: "grid_1",
        accepts: "any",
        rect: { x: 0.055, y: 0.075, w: 0.27, h: 0.4 },
      },
      {
        id: "grid_2",
        accepts: "any",
        rect: { x: 0.365, y: 0.075, w: 0.27, h: 0.4 },
      },
      {
        id: "grid_3",
        accepts: "any",
        rect: { x: 0.675, y: 0.075, w: 0.27, h: 0.4 },
      },
      {
        id: "grid_4",
        accepts: "any",
        rect: { x: 0.055, y: 0.525, w: 0.27, h: 0.4 },
      },
      {
        id: "grid_5",
        accepts: "any",
        rect: { x: 0.365, y: 0.525, w: 0.27, h: 0.4 },
      },
      {
        id: "grid_6",
        accepts: "any",
        rect: { x: 0.675, y: 0.525, w: 0.27, h: 0.4 },
      },
    ],
  },
  {
    code: "M7",
    name: "One & five",
    description:
      "Six photos: one dominant on the left plus five small on the right. The busiest spread — use at most once per album.",
    slots: [
      {
        id: "anchor",
        accepts: "any",
        emphasis: true,
        rect: { x: 0.05, y: 0.08, w: 0.42, h: 0.84 },
      },
      {
        id: "first",
        accepts: "any",
        rect: { x: 0.53, y: 0.08, w: 0.2, h: 0.4 },
      },
      {
        id: "second",
        accepts: "any",
        rect: { x: 0.53, y: 0.52, w: 0.2, h: 0.4 },
      },
      {
        id: "third",
        accepts: "any",
        rect: { x: 0.76, y: 0.08, w: 0.19, h: 0.253 },
      },
      {
        id: "fourth",
        accepts: "any",
        rect: { x: 0.76, y: 0.373, w: 0.19, h: 0.253 },
      },
      {
        id: "fifth",
        accepts: "any",
        rect: { x: 0.76, y: 0.667, w: 0.19, h: 0.253 },
      },
    ],
  },

  // --- Detail: object stories -------------------------------------------
  {
    code: "DT1",
    name: "A trio of details",
    description:
      "A trio of details — one on the left page, two on the right. Rings, florals, stationery.",
    slots: [
      {
        id: "left",
        accepts: "any",
        rect: { x: 0.15, y: 0.3, w: 0.2, h: 0.4 },
      },
      {
        id: "center",
        accepts: "any",
        rect: { x: 0.56, y: 0.3, w: 0.18, h: 0.4 },
      },
      {
        id: "right",
        accepts: "any",
        rect: { x: 0.78, y: 0.3, w: 0.18, h: 0.4 },
      },
    ],
  },
  {
    code: "DT2",
    name: "Four little things",
    description:
      "Four detail shots staggered across the spread with generous whitespace.",
    slots: [
      {
        id: "top_left",
        accepts: "any",
        rect: { x: 0.11, y: 0.2, w: 0.15, h: 0.3 },
      },
      {
        id: "top_right",
        accepts: "any",
        rect: { x: 0.29, y: 0.2, w: 0.15, h: 0.3 },
      },
      {
        id: "bottom_left",
        accepts: "any",
        rect: { x: 0.56, y: 0.5, w: 0.15, h: 0.3 },
      },
      {
        id: "bottom_right",
        accepts: "any",
        rect: { x: 0.74, y: 0.5, w: 0.15, h: 0.3 },
      },
    ],
  },
  {
    code: "DT3",
    name: "The detail story",
    description:
      "One larger detail anchor on the left with two staggered companions on the right. For when one object matters most.",
    slots: [
      {
        id: "anchor",
        accepts: "any",
        emphasis: true,
        rect: { x: 0.1, y: 0.15, w: 0.32, h: 0.64 },
      },
      {
        id: "first",
        accepts: "any",
        rect: { x: 0.56, y: 0.22, w: 0.16, h: 0.32 },
      },
      {
        id: "second",
        accepts: "any",
        rect: { x: 0.76, y: 0.46, w: 0.16, h: 0.32 },
      },
    ],
  },
] as const;

export const TEMPLATES_BY_CODE: ReadonlyMap<string, SpreadTemplate> = new Map(
  SPREAD_TEMPLATES.map((t) => [t.code, t]),
);

export function isTemplateCode(code: string): boolean {
  return TEMPLATES_BY_CODE.has(code);
}

/**
 * Whether a photo fits a slot. Squares are the flexible citizens: they sit
 * acceptably in portrait or landscape slots, but a landscape photo in a
 * portrait slot (or vice versa) crops someone's head off.
 */
export function slotAcceptsPhoto(
  accepts: SlotAccepts,
  orientation: Orientation,
): boolean {
  if (accepts === "any") return true;
  if (orientation === "square") return true;
  return accepts === orientation;
}

/** Mirror a rect across the spread's vertical center. Used by "flip
 * spread": the GEOMETRY mirrors, the photos never do. Involutive —
 * mirroring twice returns the original. */
export function mirroredRect(rect: SlotRect): SlotRect {
  return { ...rect, x: 1 - rect.x - rect.w };
}

/** Per-slot reframing as CSS object-position percentages. 50/50 = centered
 * (the default when absent). */
export type SlotCrop = { x: number; y: number };

export function clampCrop(value: unknown): SlotCrop | null {
  if (typeof value !== "object" || value === null) return null;
  const v = value as Record<string, unknown>;
  if (typeof v.x !== "number" || typeof v.y !== "number") return null;
  if (Number.isNaN(v.x) || Number.isNaN(v.y)) return null;
  const clamp = (n: number) => Math.max(0, Math.min(100, n));
  return { x: clamp(v.x), y: clamp(v.y) };
}

/** A rect is full-bleed if it touches all four edges of its page (or the
 * whole spread). Full-bleed rects are exempt from safe-margin rules. */
export function isFullBleed(rect: SlotRect): boolean {
  const fullHeight = rect.y === 0 && rect.h === 1;
  const wholeSpread = rect.x === 0 && rect.w === 1;
  const leftPage = rect.x === 0 && rect.x + rect.w === 0.5;
  const rightPage = rect.x === 0.5 && rect.x + rect.w === 1;
  return fullHeight && (wholeSpread || leftPage || rightPage);
}
