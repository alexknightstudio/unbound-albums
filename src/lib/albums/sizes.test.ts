import { describe, expect, it } from "vitest";

import {
  ALBUM_SIZE_SPECS,
  ALBUM_SIZES,
  DEFAULT_ALBUM_SIZE,
  formatPrice,
  isAlbumSize,
} from "./sizes";

describe("pricing", () => {
  // The prices CLAUDE.md locks for v1. If someone changes a price, this test
  // should fail and make them think about it.
  it("matches the locked v1 pricing", () => {
    expect(ALBUM_SIZE_SPECS["8x8"].priceCents).toBe(14900);
    expect(ALBUM_SIZE_SPECS["10x10"].priceCents).toBe(19900);
    expect(ALBUM_SIZE_SPECS["12x12"].priceCents).toBe(24900);
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
      expect(larger.inches).toBeGreaterThan(smaller.inches);
    }
  });
});

describe("formatPrice", () => {
  it("renders whole dollars without decimals", () => {
    expect(formatPrice(14900)).toBe("$149");
    expect(formatPrice(19900)).toBe("$199");
    expect(formatPrice(24900)).toBe("$249");
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
    }
  });

  it("defaults to a real size", () => {
    expect(isAlbumSize(DEFAULT_ALBUM_SIZE)).toBe(true);
  });
});

describe("isAlbumSize", () => {
  it("accepts real sizes and rejects everything else", () => {
    expect(isAlbumSize("8x8")).toBe(true);
    expect(isAlbumSize("10x10")).toBe(true);
    expect(isAlbumSize("12x12")).toBe(true);

    expect(isAlbumSize("8X8")).toBe(false);
    expect(isAlbumSize("8 x 8")).toBe(false);
    expect(isAlbumSize("14x14")).toBe(false);
    expect(isAlbumSize("")).toBe(false);
    expect(isAlbumSize(null)).toBe(false);
    expect(isAlbumSize(undefined)).toBe(false);
    expect(isAlbumSize(10)).toBe(false);
  });
});
