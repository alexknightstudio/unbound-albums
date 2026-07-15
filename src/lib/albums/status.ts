/**
 * The album status machine.
 *
 * Mirrors the database trigger in
 * supabase/migrations/*_album_status_machine.sql. The database is the authority —
 * this exists so the UI can reason about state without a round trip. If you change
 * one, change both; the tests below the fold will not catch a drift between a
 * TypeScript constant and Postgres.
 */

export const ALBUM_STATUSES = [
  "uploading",
  "analyzing",
  "generating",
  "ready",
  "ordered",
  "shipped",
] as const;

export type AlbumStatus = (typeof ALBUM_STATUSES)[number];

export const INITIAL_ALBUM_STATUS: AlbumStatus = "uploading";

/** Every legal move. Anything absent is illegal by construction. */
const LEGAL_TRANSITIONS: Record<AlbumStatus, readonly AlbumStatus[]> = {
  uploading: ["analyzing"],
  analyzing: ["generating"],
  // "ready" comes back to "generating" on a full-album regenerate — the one
  // backward edge in the machine.
  generating: ["ready"],
  ready: ["generating", "ordered"],
  ordered: ["shipped"],
  shipped: [],
};

export function canTransition(from: AlbumStatus, to: AlbumStatus): boolean {
  return LEGAL_TRANSITIONS[from].includes(to);
}

export function nextStatuses(from: AlbumStatus): readonly AlbumStatus[] {
  return LEGAL_TRANSITIONS[from];
}

/** True once the album has been paid for and is out of the couple's hands. */
export function isOrdered(status: AlbumStatus): boolean {
  return status === "ordered" || status === "shipped";
}

/** True while the couple can still change the album. */
export function isEditable(status: AlbumStatus): boolean {
  return status === "ready";
}

/** True while a background job is working and the UI should show progress. */
export function isWorking(status: AlbumStatus): boolean {
  return status === "analyzing" || status === "generating";
}

export function isAlbumStatus(value: unknown): value is AlbumStatus {
  return (
    typeof value === "string" &&
    (ALBUM_STATUSES as readonly string[]).includes(value)
  );
}

/** What a couple sees. Brand voice: short declaratives, periods. */
const STATUS_COPY: Record<AlbumStatus, string> = {
  uploading: "Waiting on your photos.",
  analyzing: "Reading your photos.",
  generating: "Designing your album.",
  ready: "Ready to view.",
  ordered: "Ordered. We're on it.",
  shipped: "On its way.",
};

export function statusCopy(status: AlbumStatus): string {
  return STATUS_COPY[status];
}
