/**
 * Pure helpers around photo analysis — no SDK, no I/O, fully testable.
 * The API route wires these to storage and the Anthropic client.
 */

import {
  ANALYSIS_MODEL,
  ANALYSIS_PROMPT_VERSION,
  CORRECTION_NEEDS,
  WEDDING_STAGES,
  type PhotoAnalysisResult,
  type StoredAnalysis,
} from "./prompts/analysis";

/**
 * Validate one item of the model's response. Structured outputs guarantee the
 * shape, but this is the last line of defense before writing to the database —
 * and the only one if the response was ever produced without schema
 * enforcement (a cached fixture, a manual test).
 */
export function isPhotoAnalysisResult(
  value: unknown,
): value is PhotoAnalysisResult {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.index === "number" &&
    Number.isInteger(v.index) &&
    typeof v.description === "string" &&
    v.description.length > 0 &&
    (WEDDING_STAGES as readonly string[]).includes(v.stage as string) &&
    (v.setting === "indoor" || v.setting === "outdoor") &&
    typeof v.is_couple_portrait === "boolean" &&
    typeof v.hero_potential === "number" &&
    typeof v.professionally_edited === "boolean" &&
    (CORRECTION_NEEDS as readonly string[]).includes(
      v.correction_needed as string,
    )
  );
}

/**
 * needs_correction, derived. Correction applies ONLY to photos the model
 * judged NOT professionally edited — a graded photo is never touched, even if
 * the model contradicts itself and names a correction for one.
 */
export function needsCorrection(result: PhotoAnalysisResult): boolean {
  return !result.professionally_edited && result.correction_needed !== "none";
}

/** Clamp hero_potential into 0–100 — the schema can't express the range. */
export function clampHeroPotential(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

/** What gets written to photos.analysis. */
export function toStoredAnalysis(
  result: PhotoAnalysisResult,
  analyzedAt: string,
): StoredAnalysis {
  const fields: Partial<PhotoAnalysisResult> = { ...result };
  delete fields.index;
  return {
    ...(fields as Omit<PhotoAnalysisResult, "index">),
    hero_potential: clampHeroPotential(result.hero_potential),
    version: ANALYSIS_PROMPT_VERSION,
    model: ANALYSIS_MODEL,
    analyzed_at: analyzedAt,
  };
}

/**
 * Match model results back to the photos in a batch by index. Photos the
 * model skipped (or hallucinated indexes for) simply stay unanalyzed and get
 * picked up by the next pass — never written with someone else's analysis.
 */
export function matchResultsToBatch<T extends { id: string }>(
  batch: readonly T[],
  results: readonly PhotoAnalysisResult[],
): Array<{ photo: T; result: PhotoAnalysisResult }> {
  const byIndex = new Map<number, PhotoAnalysisResult>();
  for (const r of results) {
    // First claim wins; a duplicate index is a model error, not a tiebreak.
    if (!byIndex.has(r.index)) byIndex.set(r.index, r);
  }

  const matched: Array<{ photo: T; result: PhotoAnalysisResult }> = [];
  batch.forEach((photo, i) => {
    const result = byIndex.get(i + 1); // photos are numbered from 1 in the prompt
    if (result && isPhotoAnalysisResult(result)) {
      matched.push({ photo, result });
    }
  });
  return matched;
}
