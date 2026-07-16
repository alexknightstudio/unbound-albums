import { describe, expect, it } from "vitest";

import {
  MAX_SPREADS,
  MIN_SPREADS,
  spreadTargetFor,
  validatePlan,
  type EnginePhoto,
  type ProposedPlan,
} from "./engine";
import {
  SPREAD_TEMPLATES,
  TEMPLATES_BY_CODE,
  slotAcceptsPhoto,
} from "./templates";

// ---------------------------------------------------------------------------
// Template contract integrity
// ---------------------------------------------------------------------------

describe("template library", () => {
  it("contains exactly the 23 codes the database check constraint allows", () => {
    const dbCodes = [
      "H1", "H2", "H3",
      "D1", "D2", "D3", "D4", "D5",
      "T1", "T2", "T3", "T4", "T5",
      "M1", "M2", "M3", "M4", "M5", "M6", "M7",
      "DT1", "DT2", "DT3",
    ];
    expect(SPREAD_TEMPLATES.map((t) => t.code).sort()).toEqual(
      [...dbCodes].sort(),
    );
  });

  it("keeps slot counts inside each family's range", () => {
    for (const t of SPREAD_TEMPLATES) {
      const n = t.slots.length;
      if (t.code.startsWith("H")) expect(n).toBe(1);
      else if (t.code.startsWith("DT")) expect(n).toBeGreaterThanOrEqual(3);
      else if (t.code.startsWith("D")) expect(n).toBe(2);
      else if (t.code.startsWith("T")) expect(n).toBe(3);
      else if (t.code.startsWith("M")) {
        expect(n).toBeGreaterThanOrEqual(4);
        expect(n).toBeLessThanOrEqual(6);
      }
    }
  });

  it("has unique slot ids within every template", () => {
    for (const t of SPREAD_TEMPLATES) {
      const ids = t.slots.map((s) => s.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });
});

describe("slotAcceptsPhoto", () => {
  it("lets squares sit anywhere", () => {
    expect(slotAcceptsPhoto("landscape", "square")).toBe(true);
    expect(slotAcceptsPhoto("portrait", "square")).toBe(true);
  });

  it("rejects a cross-orientation placement", () => {
    expect(slotAcceptsPhoto("portrait", "landscape")).toBe(false);
    expect(slotAcceptsPhoto("landscape", "portrait")).toBe(false);
  });

  it("accepts anything in an any slot", () => {
    expect(slotAcceptsPhoto("any", "landscape")).toBe(true);
    expect(slotAcceptsPhoto("any", "portrait")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Spread target
// ---------------------------------------------------------------------------

describe("spreadTargetFor", () => {
  it("targets 30 spreads for the full 150-photo album", () => {
    expect(spreadTargetFor(150)).toBe(MAX_SPREADS);
  });

  it("never exceeds the priced base of 30", () => {
    expect(spreadTargetFor(200)).toBe(MAX_SPREADS);
  });

  it("never drops below the minimum a book needs", () => {
    expect(spreadTargetFor(5)).toBe(MIN_SPREADS);
  });

  it("lands near photos/5 in between", () => {
    expect(spreadTargetFor(18)).toBe(4);
    expect(spreadTargetFor(60)).toBe(12);
  });
});

// ---------------------------------------------------------------------------
// Plan validation
// ---------------------------------------------------------------------------

function photoSet(): EnginePhoto[] {
  return [
    { id: "p1", orientation: "landscape" },
    { id: "p2", orientation: "portrait" },
    { id: "p3", orientation: "portrait" },
    { id: "p4", orientation: "square" },
  ];
}

/** A correct little plan over photoSet(): H1(p1) + T2(p2 feature, p4+p4?) */
function goodPlan(): ProposedPlan {
  return {
    spreads: [
      {
        template_code: "H1",
        assignments: [{ slot_id: "hero", photo_id: "p1" }],
        note: "Opens wide.",
      },
      {
        template_code: "T3",
        assignments: [
          { slot_id: "left", photo_id: "p2" },
          { slot_id: "center", photo_id: "p3" },
          { slot_id: "right", photo_id: "p4" }, // square in a portrait slot — fine
        ],
        note: "Portrait sequence.",
      },
    ],
    set_aside: [],
  };
}

describe("validatePlan", () => {
  it("accepts a correct plan and shapes it for the database", () => {
    const result = validatePlan(goodPlan(), photoSet());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.spreads).toHaveLength(2);
    expect(result.spreads[0]).toEqual({
      template_code: "H1",
      position: 1,
      slots: { hero: "p1" },
    });
    expect(result.spreads[1].slots).toEqual({
      left: "p2",
      center: "p3",
      right: "p4",
    });
  });

  it("rejects an empty plan", () => {
    const result = validatePlan({ spreads: [], set_aside: [] }, photoSet());
    expect(result.ok).toBe(false);
  });

  it("rejects an unknown template code", () => {
    const plan = goodPlan();
    plan.spreads[0].template_code = "H9";
    const result = validatePlan(plan, photoSet());
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.join(" ")).toContain("unknown template");
  });

  it("rejects a landscape photo in a portrait slot", () => {
    const plan: ProposedPlan = {
      spreads: [
        {
          template_code: "H2", // portrait hero
          assignments: [{ slot_id: "hero", photo_id: "p1" }], // p1 is landscape
          note: "",
        },
      ],
      set_aside: [
        { photo_id: "p2", reason: "r" },
        { photo_id: "p3", reason: "r" },
        { photo_id: "p4", reason: "r" },
      ],
    };
    const result = validatePlan(plan, photoSet());
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.join(" ")).toContain("needs portrait");
  });

  it("rejects a photo used twice", () => {
    const plan = goodPlan();
    plan.spreads[1].assignments[0].photo_id = "p1"; // p1 already the hero
    const result = validatePlan(plan, photoSet());
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.join(" ")).toContain("already used");
  });

  it("rejects an empty slot", () => {
    const plan = goodPlan();
    plan.spreads[1].assignments.pop(); // T3 right slot now empty
    plan.set_aside = [{ photo_id: "p4", reason: "r" }];
    const result = validatePlan(plan, photoSet());
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.join(" ")).toContain("left empty");
  });

  it("rejects a hallucinated photo id", () => {
    const plan = goodPlan();
    plan.spreads[0].assignments[0].photo_id = "p99";
    const result = validatePlan(plan, photoSet());
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.join(" ")).toContain("not in this album");
  });

  it("rejects a photo that is neither placed nor set aside", () => {
    const plan = goodPlan();
    plan.spreads.pop(); // drop the trio; p2–p4 now unaccounted for
    const result = validatePlan(plan, photoSet());
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.join(" ")).toContain("neither placed nor set aside");
  });

  it("rejects a photo that is both placed and set aside", () => {
    const plan = goodPlan();
    plan.set_aside = [{ photo_id: "p1", reason: "twin" }];
    const result = validatePlan(plan, photoSet());
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.join(" ")).toContain("both placed and set aside");
  });

  it("collects every error instead of stopping at the first", () => {
    const plan: ProposedPlan = {
      spreads: [
        {
          template_code: "H9", // bad code
          assignments: [],
          note: "",
        },
        {
          template_code: "H1",
          assignments: [{ slot_id: "hero", photo_id: "p99" }], // bad photo
          note: "",
        },
      ],
      set_aside: [],
    };
    const result = validatePlan(plan, photoSet());
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.length).toBeGreaterThanOrEqual(3);
  });
});

// ---------------------------------------------------------------------------
// Sanity: every template can be filled and validated end to end
// ---------------------------------------------------------------------------

describe("every template validates when filled correctly", () => {
  for (const template of SPREAD_TEMPLATES) {
    it(template.code, () => {
      const photos: EnginePhoto[] = template.slots.map((slot, i) => ({
        id: `photo_${i}`,
        // A square satisfies every accepts value.
        orientation: "square",
      }));
      const plan: ProposedPlan = {
        spreads: [
          {
            template_code: template.code,
            assignments: template.slots.map((slot, i) => ({
              slot_id: slot.id,
              photo_id: `photo_${i}`,
            })),
            note: "",
          },
        ],
        set_aside: [],
      };
      const result = validatePlan(plan, photos);
      expect(result.ok).toBe(true);
    });
  }

  it("TEMPLATES_BY_CODE indexes every template", () => {
    expect(TEMPLATES_BY_CODE.size).toBe(SPREAD_TEMPLATES.length);
  });
});
