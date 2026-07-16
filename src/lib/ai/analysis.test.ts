import { describe, expect, it } from "vitest";

import {
  clampHeroPotential,
  isPhotoAnalysisResult,
  matchResultsToBatch,
  needsCorrection,
  toStoredAnalysis,
} from "./analysis";
import {
  ANALYSIS_MODEL,
  ANALYSIS_PROMPT_VERSION,
  type PhotoAnalysisResult,
} from "./prompts/analysis";

function validResult(
  overrides: Partial<PhotoAnalysisResult> = {},
): PhotoAnalysisResult {
  return {
    index: 1,
    description: "Bride and groom under the oak tree at golden hour.",
    stage: "portraits",
    setting: "outdoor",
    time_of_day: "golden_hour",
    people: "couple",
    is_couple_portrait: true,
    emotion: "tenderness",
    shot_type: "medium",
    color_profile: "color",
    hero_potential: 88,
    professionally_edited: true,
    correction_needed: "none",
    ...overrides,
  };
}

describe("isPhotoAnalysisResult", () => {
  it("accepts a complete result", () => {
    expect(isPhotoAnalysisResult(validResult())).toBe(true);
  });

  it("rejects a bad stage", () => {
    expect(
      isPhotoAnalysisResult({ ...validResult(), stage: "honeymoon" }),
    ).toBe(false);
  });

  it("rejects an empty description", () => {
    expect(isPhotoAnalysisResult(validResult({ description: "" }))).toBe(
      false,
    );
  });

  it("rejects non-objects", () => {
    expect(isPhotoAnalysisResult(null)).toBe(false);
    expect(isPhotoAnalysisResult("photo")).toBe(false);
  });
});

describe("needsCorrection", () => {
  it("is false for professionally edited photos, whatever the model says", () => {
    // The model contradicting itself must not damage a graded photo.
    expect(
      needsCorrection(
        validResult({ professionally_edited: true, correction_needed: "both" }),
      ),
    ).toBe(false);
  });

  it("is true for an uncorrected photo needing exposure work", () => {
    expect(
      needsCorrection(
        validResult({
          professionally_edited: false,
          correction_needed: "exposure",
        }),
      ),
    ).toBe(true);
  });

  it("is false for an uncorrected photo needing nothing", () => {
    expect(
      needsCorrection(
        validResult({
          professionally_edited: false,
          correction_needed: "none",
        }),
      ),
    ).toBe(false);
  });
});

describe("clampHeroPotential", () => {
  it("clamps out-of-range values", () => {
    expect(clampHeroPotential(150)).toBe(100);
    expect(clampHeroPotential(-5)).toBe(0);
    expect(clampHeroPotential(87.6)).toBe(88);
    expect(clampHeroPotential(NaN)).toBe(0);
  });
});

describe("toStoredAnalysis", () => {
  it("stamps version, model, and timestamp, and drops the index", () => {
    const stored = toStoredAnalysis(validResult(), "2026-07-16T18:00:00Z");
    expect(stored.version).toBe(ANALYSIS_PROMPT_VERSION);
    expect(stored.model).toBe(ANALYSIS_MODEL);
    expect(stored.analyzed_at).toBe("2026-07-16T18:00:00Z");
    expect("index" in stored).toBe(false);
  });
});

describe("matchResultsToBatch", () => {
  const photos = [{ id: "a" }, { id: "b" }, { id: "c" }];

  it("matches results to photos by 1-based index", () => {
    const matched = matchResultsToBatch(photos, [
      validResult({ index: 1 }),
      validResult({ index: 3 }),
    ]);
    expect(matched.map((m) => m.photo.id)).toEqual(["a", "c"]);
  });

  it("leaves skipped and out-of-range photos unmatched", () => {
    const matched = matchResultsToBatch(photos, [
      validResult({ index: 2 }),
      validResult({ index: 9 }), // hallucinated index — must not attach anywhere
    ]);
    expect(matched.map((m) => m.photo.id)).toEqual(["b"]);
  });

  it("first claim wins on a duplicated index", () => {
    const first = validResult({ index: 1, description: "first" });
    const dupe = validResult({ index: 1, description: "second" });
    const matched = matchResultsToBatch(photos, [first, dupe]);
    expect(matched).toHaveLength(1);
    expect(matched[0].result.description).toBe("first");
  });
});
