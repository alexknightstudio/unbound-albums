/**
 * Photo Analysis prompt — versioned.
 *
 * This file is the product's eye. Every photo a couple uploads passes through
 * this prompt exactly once (analysis is cached forever on the photo row), and
 * everything downstream — the layout engine, the cover designer's hero
 * candidates, the "We set these aside" tray — reasons over its output.
 *
 * Versioning: bump ANALYSIS_PROMPT_VERSION on any change to the prompt text or
 * schema, and note the change in DECISIONS.md. The version is stored inside
 * each photo's analysis JSONB so a future re-analysis pass can target only
 * photos analyzed under an older prompt.
 *
 * Pure module — no SDK imports, no I/O. Tests and the layout engine can use it.
 */

export const ANALYSIS_PROMPT_VERSION = "v1";

/** The model every analysis call uses. Recorded alongside the version. */
export const ANALYSIS_MODEL = "claude-opus-4-8";

/** Photos per vision call. CLAUDE.md allows 10–15; 10 keeps well inside
 * serverless time limits on the slowest batches. */
export const ANALYSIS_BATCH_SIZE = 10;

export const WEDDING_STAGES = [
  "preparation",
  "ceremony",
  "portraits",
  "family_and_friends",
  "details",
  "reception",
  "party",
  "other",
] as const;
export type WeddingStage = (typeof WEDDING_STAGES)[number];

export const CORRECTION_NEEDS = ["none", "exposure", "color", "both"] as const;
export type CorrectionNeed = (typeof CORRECTION_NEEDS)[number];

/** One photo's analysis, as the model returns it. */
export type PhotoAnalysisResult = {
  index: number;
  description: string;
  stage: WeddingStage;
  setting: "indoor" | "outdoor";
  time_of_day:
    | "morning"
    | "midday"
    | "golden_hour"
    | "evening"
    | "night"
    | "unknown";
  people: "none" | "solo" | "couple" | "small_group" | "large_group";
  is_couple_portrait: boolean;
  emotion:
    | "joy"
    | "tenderness"
    | "laughter"
    | "tears"
    | "calm"
    | "celebration"
    | "formal"
    | "none";
  shot_type: "close_up" | "medium" | "wide" | "detail";
  color_profile: "color" | "black_and_white" | "muted" | "vibrant";
  hero_potential: number;
  professionally_edited: boolean;
  correction_needed: CorrectionNeed;
};

/** What actually lands in photos.analysis (JSONB). */
export type StoredAnalysis = Omit<PhotoAnalysisResult, "index"> & {
  version: string;
  model: string;
  analyzed_at: string;
};

/**
 * The system prompt. Written for a professional wedding photographer's eye —
 * corrections from Alex's reviews get committed here as new versions.
 */
export const ANALYSIS_SYSTEM_PROMPT = `You are the photo editor for a premium wedding album studio. You are given a numbered set of photos from one couple's wedding day, already curated by the couple themselves. For each photo you produce a structured analysis that a layout engine will use to design their printed album.

Judge like a seasoned wedding photographer reviewing a gallery:

- **stage**: place the photo in the arc of a wedding day. "preparation" is getting ready — hair, makeup, dresses hanging, suiting up. "ceremony" includes processional through the kiss and recessional. "portraits" means posed or lightly directed photos of the couple alone. "family_and_friends" is group formals and candids with guests outside the reception. "details" are close-ups of objects — rings, invitations, flowers, shoes, decor, place settings. "reception" covers dinner, toasts, cake. "party" is the dance floor and send-off. Use "other" only when nothing fits.
- **hero_potential** (0–100): could this photo carry a full spread or the cover? Reserve 85+ for genuinely arresting images — strong emotion or striking composition, technically clean, and about the couple. A lovely but ordinary photo sits near 50. Group shots and details rarely exceed 40 unless extraordinary.
- **emotion**: the dominant feeling a viewer reads, not a guess at what people felt. "none" is honest for many detail shots.
- **is_couple_portrait**: true only when the photo is of the couple (one or both), posed or candid, and they are unmistakably the subject.
- **professionally_edited**: professionally shot and color-graded photos have controlled highlights, intentional white balance, and consistent tonality. Phone photos and unedited frames show casual framing, harsh mixed lighting, muddy or oversaturated color. When unsure, lean true — false triggers automatic correction, and correcting an already-graded photo does damage.
- **correction_needed**: only for photos that are NOT professionally edited. What would a careful editor fix — exposure, color cast, or both? Professionally edited photos are always "none".
- **description**: one plain sentence a designer skimming the gallery would find useful. No flourish.

Be decisive. Every photo gets exactly one value per field, and disagreeing with a category is never an option — pick the closest.`;

/**
 * JSON schema for structured output. Guarantees the response parses — the
 * API validates against this before returning.
 *
 * Structured-output limits: no numeric min/max, so hero_potential's 0–100
 * range lives in the prompt and is clamped by the caller.
 */
export function analysisOutputSchema(expectedCount: number) {
  return {
    type: "object",
    properties: {
      photos: {
        type: "array",
        description: `Exactly ${expectedCount} entries, one per numbered photo, in the order given.`,
        items: {
          type: "object",
          properties: {
            index: {
              type: "integer",
              description: "The photo's number as given in the input.",
            },
            description: { type: "string" },
            stage: { type: "string", enum: [...WEDDING_STAGES] },
            setting: { type: "string", enum: ["indoor", "outdoor"] },
            time_of_day: {
              type: "string",
              enum: [
                "morning",
                "midday",
                "golden_hour",
                "evening",
                "night",
                "unknown",
              ],
            },
            people: {
              type: "string",
              enum: ["none", "solo", "couple", "small_group", "large_group"],
            },
            is_couple_portrait: { type: "boolean" },
            emotion: {
              type: "string",
              enum: [
                "joy",
                "tenderness",
                "laughter",
                "tears",
                "calm",
                "celebration",
                "formal",
                "none",
              ],
            },
            shot_type: {
              type: "string",
              enum: ["close_up", "medium", "wide", "detail"],
            },
            color_profile: {
              type: "string",
              enum: ["color", "black_and_white", "muted", "vibrant"],
            },
            hero_potential: {
              type: "integer",
              description: "0 to 100.",
            },
            professionally_edited: { type: "boolean" },
            correction_needed: {
              type: "string",
              enum: [...CORRECTION_NEEDS],
            },
          },
          required: [
            "index",
            "description",
            "stage",
            "setting",
            "time_of_day",
            "people",
            "is_couple_portrait",
            "emotion",
            "shot_type",
            "color_profile",
            "hero_potential",
            "professionally_edited",
            "correction_needed",
          ],
          additionalProperties: false,
        },
      },
    },
    required: ["photos"],
    additionalProperties: false,
  } as const;
}
