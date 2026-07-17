import { describe, expect, it } from "vitest";

import {
  assignPhotosToTemplate,
  compatibleTemplates,
  validateSpreadSlots,
} from "./editing";
import { TEMPLATES_BY_CODE } from "./templates";

import type { EnginePhoto } from "./engine";

const photos: EnginePhoto[] = [
  { id: "land1", orientation: "landscape" },
  { id: "land2", orientation: "landscape" },
  { id: "port1", orientation: "portrait" },
  { id: "port2", orientation: "portrait" },
  { id: "port3", orientation: "portrait" },
  { id: "sq1", orientation: "square" },
];

describe("validateSpreadSlots", () => {
  it("accepts a valid full assignment", () => {
    const result = validateSpreadSlots(
      "D1",
      { left: "port1", right: "port2" },
      photos,
      new Set(),
    );
    expect(result.ok).toBe(true);
  });

  it("accepts empty slots mid-edit", () => {
    const result = validateSpreadSlots("D1", { left: "port1" }, photos, new Set());
    expect(result.ok).toBe(true);
    if (result.ok) expect(Object.keys(result.slots)).toEqual(["left"]);
  });

  it("rejects an unknown slot id", () => {
    const result = validateSpreadSlots(
      "D1",
      { middle: "port1" },
      photos,
      new Set(),
    );
    expect(result.ok).toBe(false);
  });

  it("rejects a photo from outside the album", () => {
    const result = validateSpreadSlots(
      "D1",
      { left: "stranger" },
      photos,
      new Set(),
    );
    expect(result.ok).toBe(false);
  });

  it("rejects orientation violations", () => {
    const result = validateSpreadSlots(
      "D1",
      { left: "land1" }, // D1.left needs portrait
      photos,
      new Set(),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("portrait");
  });

  it("lets squares into orientation-constrained slots", () => {
    const result = validateSpreadSlots("D1", { left: "sq1" }, photos, new Set());
    expect(result.ok).toBe(true);
  });

  it("rejects a photo already used on another spread", () => {
    const result = validateSpreadSlots(
      "D1",
      { left: "port1" },
      photos,
      new Set(["port1"]),
    );
    expect(result.ok).toBe(false);
  });

  it("rejects the same photo in two slots", () => {
    const result = validateSpreadSlots(
      "D1",
      { left: "port1", right: "port1" },
      photos,
      new Set(),
    );
    expect(result.ok).toBe(false);
  });
});

describe("assignPhotosToTemplate", () => {
  it("puts the first photo on the emphasis slot when it fits", () => {
    const t2 = TEMPLATES_BY_CODE.get("T2")!; // portrait feature + 2 landscape
    const assignment = assignPhotosToTemplate(t2, [
      { id: "port1", orientation: "portrait" },
      { id: "land1", orientation: "landscape" },
      { id: "land2", orientation: "landscape" },
    ]);
    expect(assignment).not.toBeNull();
    expect(assignment!.feature).toBe("port1");
  });

  it("returns null when photos cannot all fit", () => {
    const t2 = TEMPLATES_BY_CODE.get("T2")!; // needs 1 portrait + 2 landscape
    const assignment = assignPhotosToTemplate(t2, [
      { id: "land1", orientation: "landscape" },
      { id: "land2", orientation: "landscape" },
      { id: "land3", orientation: "landscape" },
    ]);
    expect(assignment).toBeNull();
  });

  it("assigns fewer photos than slots, leaving the rest empty", () => {
    const m1 = TEMPLATES_BY_CODE.get("M1")!; // 4 any slots
    const assignment = assignPhotosToTemplate(m1, [
      { id: "land1", orientation: "landscape" },
      { id: "port1", orientation: "portrait" },
    ]);
    expect(assignment).not.toBeNull();
    expect(Object.keys(assignment!)).toHaveLength(2);
  });
});

describe("compatibleTemplates", () => {
  it("finds hero templates for a single landscape", () => {
    const codes = compatibleTemplates([
      { id: "land1", orientation: "landscape" },
    ]).map((t) => t.code);
    expect(codes).toContain("H1");
    expect(codes).toContain("H3");
    expect(codes).not.toContain("H2"); // portrait-only hero
  });

  it("excludes templates with fewer slots than photos", () => {
    const codes = compatibleTemplates([
      { id: "a", orientation: "square" },
      { id: "b", orientation: "square" },
      { id: "c", orientation: "square" },
    ]).map((t) => t.code);
    expect(codes).not.toContain("H1");
    expect(codes).not.toContain("D1");
    expect(codes).toContain("T5");
    expect(codes).toContain("M1"); // 4 slots, 3 photos — one left empty
  });

  it("respects orientation constraints across the set", () => {
    // Three landscapes can't fill T3 (three portrait slots).
    const codes = compatibleTemplates([
      { id: "a", orientation: "landscape" },
      { id: "b", orientation: "landscape" },
      { id: "c", orientation: "landscape" },
    ]).map((t) => t.code);
    expect(codes).not.toContain("T3");
    expect(codes).toContain("T1");
  });
});
