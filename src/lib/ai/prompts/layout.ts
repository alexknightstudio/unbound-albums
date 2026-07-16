/**
 * Layout Engine prompt — versioned.
 *
 * Takes every photo's analysis metadata and returns a complete spread plan:
 * template codes + slot assignments following the chronological arc of the
 * wedding day. The engine module (src/lib/engine/) validates everything this
 * returns before a single row is written — the model proposes, the contract
 * disposes.
 *
 * Bump LAYOUT_PROMPT_VERSION on any change, note it in DECISIONS.md.
 * Pure module — no SDK imports, no I/O.
 */

import { SPREAD_TEMPLATES } from "@/lib/engine/templates";

export const LAYOUT_PROMPT_VERSION = "v1";

export const LAYOUT_MODEL = "claude-opus-4-8";

/** What the layout prompt needs to know about one photo. */
export type LayoutPhoto = {
  id: string;
  upload_order: number;
  orientation: "portrait" | "landscape" | "square";
  stage: string;
  time_of_day: string;
  people: string;
  is_couple_portrait: boolean;
  emotion: string;
  shot_type: string;
  color_profile: string;
  hero_potential: number;
  description: string;
};

/** The plan as the model returns it. */
export type RawSpreadPlan = {
  spreads: Array<{
    template_code: string;
    /** Array (not a map) because strict JSON schema can't express dynamic
     * object keys. The engine converts to the {slot_id: photo_id} shape the
     * database stores. */
    assignments: Array<{ slot_id: string; photo_id: string }>;
    /** The model's one-line reason — surfaced to Alex during prompt review,
     * never shown to couples. */
    note: string;
  }>;
  /** Photos deliberately left out (near-duplicates, weakest frames). Shown
   * in the "We set these aside" tray — trust through transparency. */
  set_aside: Array<{ photo_id: string; reason: string }>;
};

function templateLibraryText(): string {
  return SPREAD_TEMPLATES.map((t) => {
    const slots = t.slots
      .map(
        (s) =>
          `${s.id} (${s.accepts}${s.emphasis ? ", emphasis" : ""})`,
      )
      .join(", ");
    return `- ${t.code} [${t.slots.length} photo${t.slots.length === 1 ? "" : "s"}]: ${t.description} Slots: ${slots}`;
  }).join("\n");
}

export const LAYOUT_SYSTEM_PROMPT = `You are the album designer for a premium wedding album studio. You receive the analyzed metadata for every photo a couple selected, and you design their complete printed album as a sequence of two-page spreads.

## The template library

Every spread uses exactly one template. A template's slots must ALL be filled — no empty slots, no extras. A slot marked with a specific orientation only accepts that orientation (square photos fit any slot). Put the strongest photo of a spread in the emphasis slot when there is one.

${templateLibraryText()}

## Design principles

1. **Chronology is sacred.** The album tells the wedding day in order: preparation, details of the morning, ceremony, family and friends, portraits, reception details, reception, party. Never cut backward in time. Within a stage, use upload_order as the tiebreak — couples upload roughly in sequence.
2. **Pacing.** An album breathes: a full spread of one arresting image, then a denser spread of moments, then air again. Never two Multi (M) spreads in a row. Open the album with a strong establishing spread and close with a quiet or celebratory one — the last page is the aftertaste.
3. **Heroes earn their space.** Photos with hero_potential 85+ deserve Hero (H) treatment or an emphasis slot. Never bury a 90 in a six-photo grid. Use H1 full-bleed at most three times — scarcity is what makes it land.
4. **Details cluster.** Rings, stationery, florals, decor belong together on Detail (DT) spreads placed where they happened in the day — morning details early, tablescape details before the reception.
5. **Orientation honesty.** Respect slot orientation constraints exactly. If the photos you want don't fit a template, pick a different template — never force a landscape into a portrait slot.
6. **Set-asides are a kindness.** When two photos are near-duplicates or a frame is clearly the weakest of a sequence, set it aside with a short warm reason ("A near-twin of the photo before it"). Couples see these reasons. Never set aside more than a fifth of the photos.
7. **Emotion arcs.** Cluster laughter with laughter, tears with tears. A tender portrait spread lands harder after an energetic group spread.

## Output

Return the complete plan: every spread in order with its template code and every slot filled with a photo_id from the input, plus the set-aside list. Photo ids must be copied exactly. Each photo appears at most once across the whole plan. Aim for the target spread count you are given — one or two over or under is acceptable when the photos demand it.`;

/**
 * The user message for one album. Metadata only — the model already analyzed
 * the pixels; layout reasons over the analysis.
 */
export function layoutUserMessage(
  photos: readonly LayoutPhoto[],
  targetSpreads: number,
): string {
  return [
    `Design the album. ${photos.length} photos, target ${targetSpreads} spreads.`,
    ``,
    `Photos (in upload order):`,
    JSON.stringify(photos, null, 1),
  ].join("\n");
}

/** Structured-output schema for the plan. */
export function layoutOutputSchema() {
  return {
    type: "object",
    properties: {
      spreads: {
        type: "array",
        items: {
          type: "object",
          properties: {
            template_code: {
              type: "string",
              enum: SPREAD_TEMPLATES.map((t) => t.code),
            },
            assignments: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  slot_id: { type: "string" },
                  photo_id: { type: "string" },
                },
                required: ["slot_id", "photo_id"],
                additionalProperties: false,
              },
            },
            note: { type: "string" },
          },
          required: ["template_code", "assignments", "note"],
          additionalProperties: false,
        },
      },
      set_aside: {
        type: "array",
        items: {
          type: "object",
          properties: {
            photo_id: { type: "string" },
            reason: { type: "string" },
          },
          required: ["photo_id", "reason"],
          additionalProperties: false,
        },
      },
    },
    required: ["spreads", "set_aside"],
    additionalProperties: false,
  } as const;
}
