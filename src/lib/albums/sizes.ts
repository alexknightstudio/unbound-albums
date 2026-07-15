/**
 * Album sizes and pricing.
 *
 * CLAUDE.md calls v1 pricing a placeholder that must stay easily configurable —
 * so it lives here as data, in cents, and nothing else hardcodes a price.
 */

export const ALBUM_SIZES = ["8x8", "10x10", "12x12"] as const;

export type AlbumSize = (typeof ALBUM_SIZES)[number];

export type AlbumSizeSpec = {
  size: AlbumSize;
  /** As a couple would say it, not as the database stores it. */
  label: string;
  /** Cents. Integers only — never floats for money. */
  priceCents: number;
  inches: number;
};

export const ALBUM_SIZE_SPECS: Record<AlbumSize, AlbumSizeSpec> = {
  "8x8": { size: "8x8", label: "8 × 8", priceCents: 14900, inches: 8 },
  "10x10": { size: "10x10", label: "10 × 10", priceCents: 19900, inches: 10 },
  "12x12": { size: "12x12", label: "12 × 12", priceCents: 24900, inches: 12 },
};

/** Base spreads included at every size. */
export const BASE_SPREAD_COUNT = 30;

export const DEFAULT_ALBUM_SIZE: AlbumSize = "10x10";

export function isAlbumSize(value: unknown): value is AlbumSize {
  return (
    typeof value === "string" && (ALBUM_SIZES as readonly string[]).includes(value)
  );
}

/** "$149" — whole dollars, since every price is whole dollars. Revisit if that changes. */
export function formatPrice(cents: number): string {
  const dollars = cents / 100;
  return Number.isInteger(dollars)
    ? `$${dollars}`
    : `$${dollars.toFixed(2)}`;
}
