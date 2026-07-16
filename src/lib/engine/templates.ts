/**
 * The spread template contract.
 *
 * 23 templates: Hero H1–H3, Duo D1–D5, Trio T1–T5, Multi M1–M7, Detail
 * DT1–DT3 — the same set the database check constraint enforces on
 * spreads.template_code. Phase 3 gives each code a React component with real
 * geometry; this file defines what the layout engine is allowed to assume:
 * how many slots, their ids, and which orientations each slot accepts.
 *
 * Pure data. No imports. The engine, the prompts, the UI, and the tests all
 * read from here — one source of truth for the contract.
 */

import type { Orientation } from "@/lib/photos/thumbnails";

export type SlotAccepts = Orientation | "any";

export type TemplateSlot = {
  id: string;
  /** Hard constraint. "any" fits every photo; a specific orientation only
   * accepts that orientation (squares also fit portrait/landscape slots —
   * see slotAcceptsPhoto). */
  accepts: SlotAccepts;
  /** The visually dominant slot, when the template has one. The engine puts
   * the strongest photo here. */
  emphasis?: boolean;
};

export type SpreadTemplate = {
  code: string;
  /** One-line description — rendered into the layout prompt so the model
   * knows what it's choosing. */
  description: string;
  slots: readonly TemplateSlot[];
};

export const SPREAD_TEMPLATES: readonly SpreadTemplate[] = [
  // --- Hero: one photo carries the whole spread -------------------------
  {
    code: "H1",
    description:
      "Full-bleed landscape hero across both pages. The single most impactful treatment — reserve for the strongest wide images.",
    slots: [{ id: "hero", accepts: "landscape", emphasis: true }],
  },
  {
    code: "H2",
    description:
      "Portrait hero on the right page with generous empty left page. Editorial and quiet.",
    slots: [{ id: "hero", accepts: "portrait", emphasis: true }],
  },
  {
    code: "H3",
    description:
      "One photo centered on the spread with wide margins. Works for any orientation; formal and gallery-like.",
    slots: [{ id: "hero", accepts: "any", emphasis: true }],
  },

  // --- Duo: two photos in conversation ---------------------------------
  {
    code: "D1",
    description: "Two portraits, one per page. A classic pairing spread.",
    slots: [
      { id: "left", accepts: "portrait" },
      { id: "right", accepts: "portrait" },
    ],
  },
  {
    code: "D2",
    description: "Two landscapes, one centered on each page.",
    slots: [
      { id: "left", accepts: "landscape" },
      { id: "right", accepts: "landscape" },
    ],
  },
  {
    code: "D3",
    description:
      "Full-bleed landscape on the left page, smaller portrait floated on the right.",
    slots: [
      { id: "feature", accepts: "landscape", emphasis: true },
      { id: "companion", accepts: "portrait" },
    ],
  },
  {
    code: "D4",
    description:
      "Large portrait on the left page, landscape centered on the right.",
    slots: [
      { id: "feature", accepts: "portrait", emphasis: true },
      { id: "companion", accepts: "landscape" },
    ],
  },
  {
    code: "D5",
    description:
      "Two photos of any orientation, small and centered with generous whitespace. Quietest duo.",
    slots: [
      { id: "left", accepts: "any" },
      { id: "right", accepts: "any" },
    ],
  },

  // --- Trio: three photos, one usually leading -------------------------
  {
    code: "T1",
    description:
      "Landscape feature filling the left page; two photos stacked on the right.",
    slots: [
      { id: "feature", accepts: "landscape", emphasis: true },
      { id: "stack_top", accepts: "any" },
      { id: "stack_bottom", accepts: "any" },
    ],
  },
  {
    code: "T2",
    description:
      "Portrait feature on the left page; two landscapes stacked on the right.",
    slots: [
      { id: "feature", accepts: "portrait", emphasis: true },
      { id: "stack_top", accepts: "landscape" },
      { id: "stack_bottom", accepts: "landscape" },
    ],
  },
  {
    code: "T3",
    description:
      "Three portraits in a row across the spread. Rhythmic; great for a sequence.",
    slots: [
      { id: "left", accepts: "portrait" },
      { id: "center", accepts: "portrait" },
      { id: "right", accepts: "portrait" },
    ],
  },
  {
    code: "T4",
    description:
      "Wide landscape across the top of the spread; two photos side by side below.",
    slots: [
      { id: "feature", accepts: "landscape", emphasis: true },
      { id: "below_left", accepts: "any" },
      { id: "below_right", accepts: "any" },
    ],
  },
  {
    code: "T5",
    description:
      "Loose asymmetric arrangement of three photos of any orientation.",
    slots: [
      { id: "first", accepts: "any", emphasis: true },
      { id: "second", accepts: "any" },
      { id: "third", accepts: "any" },
    ],
  },

  // --- Multi: four to six photos, momentum spreads ----------------------
  {
    code: "M1",
    description: "Four photos in a clean 2×2 grid.",
    slots: [
      { id: "top_left", accepts: "any" },
      { id: "top_right", accepts: "any" },
      { id: "bottom_left", accepts: "any" },
      { id: "bottom_right", accepts: "any" },
    ],
  },
  {
    code: "M2",
    description:
      "Landscape feature on the left page; three photos arranged on the right.",
    slots: [
      { id: "feature", accepts: "landscape", emphasis: true },
      { id: "first", accepts: "any" },
      { id: "second", accepts: "any" },
      { id: "third", accepts: "any" },
    ],
  },
  {
    code: "M3",
    description:
      "Portrait feature on the right page; three photos stacked on the left.",
    slots: [
      { id: "feature", accepts: "portrait", emphasis: true },
      { id: "first", accepts: "any" },
      { id: "second", accepts: "any" },
      { id: "third", accepts: "any" },
    ],
  },
  {
    code: "M4",
    description:
      "Five photos: one large anchor plus four smaller around it. Reception energy.",
    slots: [
      { id: "anchor", accepts: "any", emphasis: true },
      { id: "first", accepts: "any" },
      { id: "second", accepts: "any" },
      { id: "third", accepts: "any" },
      { id: "fourth", accepts: "any" },
    ],
  },
  {
    code: "M5",
    description: "Five photos in a filmstrip row plus one wide above.",
    slots: [
      { id: "feature", accepts: "landscape", emphasis: true },
      { id: "strip_1", accepts: "any" },
      { id: "strip_2", accepts: "any" },
      { id: "strip_3", accepts: "any" },
      { id: "strip_4", accepts: "any" },
    ],
  },
  {
    code: "M6",
    description: "Six photos in a 3×2 grid. Candid momentum; dance floor.",
    slots: [
      { id: "grid_1", accepts: "any" },
      { id: "grid_2", accepts: "any" },
      { id: "grid_3", accepts: "any" },
      { id: "grid_4", accepts: "any" },
      { id: "grid_5", accepts: "any" },
      { id: "grid_6", accepts: "any" },
    ],
  },
  {
    code: "M7",
    description:
      "Six photos: one dominant plus five small. The busiest spread — use at most once per album.",
    slots: [
      { id: "anchor", accepts: "any", emphasis: true },
      { id: "first", accepts: "any" },
      { id: "second", accepts: "any" },
      { id: "third", accepts: "any" },
      { id: "fourth", accepts: "any" },
      { id: "fifth", accepts: "any" },
    ],
  },

  // --- Detail: object stories -------------------------------------------
  {
    code: "DT1",
    description:
      "Three detail shots in a centered row — rings, florals, stationery.",
    slots: [
      { id: "left", accepts: "any" },
      { id: "center", accepts: "any" },
      { id: "right", accepts: "any" },
    ],
  },
  {
    code: "DT2",
    description:
      "Four detail shots in a 2×2 arrangement with generous whitespace.",
    slots: [
      { id: "top_left", accepts: "any" },
      { id: "top_right", accepts: "any" },
      { id: "bottom_left", accepts: "any" },
      { id: "bottom_right", accepts: "any" },
    ],
  },
  {
    code: "DT3",
    description:
      "One larger detail anchor with two companions. For when one object matters most.",
    slots: [
      { id: "anchor", accepts: "any", emphasis: true },
      { id: "first", accepts: "any" },
      { id: "second", accepts: "any" },
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
