/**
 * Album sizes and pricing.
 *
 * CLAUDE.md calls v1 pricing a placeholder that must stay easily configurable —
 * so it lives here as data, in cents, and nothing else hardcodes a price.
 *
 * Lineup (2026-07-16, competitive research + Alex): 10×10 hero, 12×12, 11×14.
 * 8×8 dropped — below the premium set, and its fourth aspect ratio taxed the
 * template system. Prices are deliberate placeholders in the $200s: real
 * economics land with the DreamBooks Pro conversation. The database enum
 * retains '8x8' (enum values can't be removed); the product no longer offers it.
 */

export const ALBUM_SIZES = ["10x10", "12x12", "11x14"] as const;

export type AlbumSize = (typeof ALBUM_SIZES)[number];

export type AlbumSizeSpec = {
  size: AlbumSize;
  /** As a couple would say it, not as the database stores it. */
  label: string;
  /** Cents. Integers only — never floats for money. */
  priceCents: number;
  /** One PAGE, in inches. A spread is two pages: width doubles, height stays.
   * Print files (Miller's spec): full spread at 250 DPI, no bleed. */
  pageWidthIn: number;
  pageHeightIn: number;
};

export const ALBUM_SIZE_SPECS: Record<AlbumSize, AlbumSizeSpec> = {
  "10x10": {
    size: "10x10",
    label: "10 × 10",
    priceCents: 24900,
    pageWidthIn: 10,
    pageHeightIn: 10,
  },
  "12x12": {
    size: "12x12",
    label: "12 × 12",
    priceCents: 27900,
    pageWidthIn: 12,
    pageHeightIn: 12,
  },
  "11x14": {
    size: "11x14",
    label: "11 × 14",
    priceCents: 29900,
    pageWidthIn: 11,
    pageHeightIn: 14,
  },
};

/** Base spreads included at every size. The album IS 15 spreads in v1 —
 * flat price, real page count, curation as a feature. */
export const BASE_SPREAD_COUNT = 15;

export const DEFAULT_ALBUM_SIZE: AlbumSize = "10x10";

export function isAlbumSize(value: unknown): value is AlbumSize {
  return (
    typeof value === "string" && (ALBUM_SIZES as readonly string[]).includes(value)
  );
}

/** Print resolution for the lab PDF (Miller's spec: full spreads, 250 DPI). */
export const PRINT_DPI = 250;

/** The designed album's print-ready files, for couples who print elsewhere.
 * Cents, like every price. (Pivot 2026-07-17: design is free; files are not.) */
export const DOWNLOAD_PRICE_CENTS = 9900;

/** "$249" — whole dollars, since every price is whole dollars. Revisit if that changes. */
export function formatPrice(cents: number): string {
  const dollars = cents / 100;
  return Number.isInteger(dollars)
    ? `$${dollars}`
    : `$${dollars.toFixed(2)}`;
}
