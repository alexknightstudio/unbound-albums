import { describe, expect, it } from "vitest";

import {
  ALBUM_SIZE_SPECS,
  ALBUM_SIZES,
  BASE_SPREAD_COUNT,
  DEFAULT_ALBUM_SIZE,
  formatPrice,
  isAlbumSize,
} from "./sizes";

describe("pricing", () => {
  // Placeholder prices pending the DreamBooks Pro conversation (2026-07-16).
  // If someone changes a price, this test should fail and make them think.
  it("matches the current placeholder pricing", () => {
    expect(ALBUM_SIZE_SPECS["10x10"].priceCents).toBe(24900);
    expect(ALBUM_SIZE_SPECS["12x12"].priceCents).toBe(27900);
    expect(ALBUM_SIZE_SPECS["11x14"].priceCents).toBe(29900);
  });

  it("prices in whole cents — never floats for money", () => {
    for (const size of ALBUM_SIZES) {
      expect(Number.isInteger(ALBUM_SIZE_SPECS[size].priceCents)).toBe(true);
    }
  });

  it("charges more for bigger", () => {
    for (let i = 0; i < ALBUM_SIZES.length - 1; i++) {
      const smaller = ALBUM_SIZE_SPECS[ALBUM_SIZES[i]];
      const larger = ALBUM_SIZE_SPECS[ALBUM_SIZES[i + 1]];
      expect(larger.priceCents).toBeGreaterThan(smaller.priceCents);
      expect(
        larger.pageWidthIn * larger.pageHeightIn,
      ).toBeGreaterThan(smaller.pageWidthIn * smaller.pageHeightIn);
    }
  });
});

describe("formatPrice", () => {
  it("renders whole dollars without decimals", () => {
    expect(formatPrice(24900)).toBe("$249");
    expect(formatPrice(27900)).toBe("$279");
    expect(formatPrice(29900)).toBe("$299");
  });

  it("shows cents when there are cents", () => {
    expect(formatPrice(14950)).toBe("$149.50");
    expect(formatPrice(1)).toBe("$0.01");
  });

  it("handles zero", () => {
    expect(formatPrice(0)).toBe("$0");
  });
});

describe("size specs", () => {
  it("has a spec for every size, keyed consistently", () => {
    for (const size of ALBUM_SIZES) {
      const spec = ALBUM_SIZE_SPECS[size];
      expect(spec).toBeDefined();
      // A spec filed under the wrong key would silently mis-price an album.
      expect(spec.size).toBe(size);
      expect(spec.label.length).toBeGreaterThan(0);
      expect(spec.pageWidthIn).toBeGreaterThan(0);
      expect(spec.pageHeightIn).toBeGreaterThan(0);
    }
  });

  it("defaults to a real size", () => {
    expect(isAlbumSize(DEFAULT_ALBUM_SIZE)).toBe(true);
  });

  it("the album is 15 spreads (v2 decision, 2026-07-16)", () => {
    expect(BASE_SPREAD_COUNT).toBe(15);
  });
});

describe("isAlbumSize", () => {
  it("accepts real sizes and rejects everything else", () => {
    expect(isAlbumSize("10x10")).toBe(true);
    expect(isAlbumSize("12x12")).toBe(true);
    expect(isAlbumSize("11x14")).toBe(true);

    // 8x8 was dropped from the lineup (2026-07-16); the DB enum keeps the
    // value but the product must not accept it.
    expect(isAlbumSize("8x8")).toBe(false);
    expect(isAlbumSize("10X10")).toBe(false);
    expect(isAlbumSize("10 x 10")).toBe(false);
    expect(isAlbumSize("14x14")).toBe(false);
    expect(isAlbumSize("")).toBe(false);
    expect(isAlbumSize(null)).toBe(false);
    expect(isAlbumSize(undefined)).toBe(false);
    expect(isAlbumSize(10)).toBe(false);
  });
});
