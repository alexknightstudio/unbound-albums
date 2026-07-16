import { describe, expect, it } from "vitest";

import { orientationFor, THUMB_LONG_EDGE, THUMB_QUALITY } from "./thumbnails";

describe("orientationFor", () => {
  it("classifies the obvious cases", () => {
    expect(orientationFor(600, 400)).toBe("landscape");
    expect(orientationFor(400, 600)).toBe("portrait");
    expect(orientationFor(600, 600)).toBe("square");
  });

  it("classifies real wedding files", () => {
    // From Alex's own exports — 60MP portrait, and a landscape.
    expect(orientationFor(6336, 9504)).toBe("portrait");
    expect(orientationFor(4009, 6014)).toBe("portrait");
    expect(orientationFor(3000, 2000)).toBe("landscape");
  });

  it("calls a one-pixel difference by that pixel, not 'square'", () => {
    // No tolerance band on purpose: the layout engine's slots have real aspect
    // ratios, so a near-square photo still has to go somewhere definite.
    expect(orientationFor(601, 600)).toBe("landscape");
    expect(orientationFor(600, 601)).toBe("portrait");
  });
});

describe("thumbnail settings", () => {
  it("is big enough for a retina filmstrip and small enough to be cheap", () => {
    expect(THUMB_LONG_EDGE).toBeGreaterThanOrEqual(400);
    expect(THUMB_LONG_EDGE).toBeLessThanOrEqual(1200);
  });

  it("uses a sane JPEG quality", () => {
    expect(THUMB_QUALITY).toBeGreaterThanOrEqual(70);
    expect(THUMB_QUALITY).toBeLessThanOrEqual(90);
  });
});
