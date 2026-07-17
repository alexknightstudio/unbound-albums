/**
 * The album status machine — v2, the designed-for-you flow.
 *
 * Mirrors the database trigger in
 * supabase/migrations/*_album_status_machine.sql and *_pivot_designed_for_you.sql.
 * The database is the authority — this exists so the UI can reason about state
 * without a round trip. If you change one, change both; the tests will not catch
 * a drift between a TypeScript constant and Postgres.
 *
 * The live path:
 *   uploading → briefing → in_design → proof_ready ⇄ in_revision
 *                                      proof_ready → approved → ordered → shipped
 *
 * "analyzing", "generating" and "ready" are LEGACY states from the AI-designed
 * era (see the 2026-07-17 pivot in CLAUDE.md). They stay in the enum because
 * Postgres enums can't shrink and old albums still hold them, but no new album
 * enters them. A legacy "ready" album can still be ordered.
 */

export const ALBUM_STATUSES = [
  "uploading",
  "briefing",
  "in_design",
  "proof_ready",
  "in_revision",
  "approved",
  // Legacy AI-era states — dormant, kept for old rows.
  "analyzing",
  "generating",
  "ready",
  // Fulfillment.
  "ordered",
  "shipped",
] as const;

export type AlbumStatus = (typeof ALBUM_STATUSES)[number];

export const INITIAL_ALBUM_STATUS: AlbumStatus = "uploading";

/** Statuses a new album can actually pass through (excludes the legacy AI path). */
export const LIVE_STATUSES: readonly AlbumStatus[] = [
  "uploading",
  "briefing",
  "in_design",
  "proof_ready",
  "in_revision",
  "approved",
  "ordered",
  "shipped",
];

/** Every legal move. Anything absent is illegal by construction. */
const LEGAL_TRANSITIONS: Record<AlbumStatus, readonly AlbumStatus[]> = {
  uploading: ["briefing"],
  briefing: ["in_design"],
  in_design: ["proof_ready"],
  // The revision loop — the couple sends notes, the designer answers with a
  // new proof round.
  proof_ready: ["in_revision", "approved"],
  in_revision: ["proof_ready"],
  approved: ["ordered"],
  ordered: ["shipped"],
  shipped: [],
  // Legacy AI path: no way in, one way out (an old finished album can still
  // be ordered).
  analyzing: [],
  generating: [],
  ready: ["ordered"],
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

/** True while the album sits with the designer and the couple is waiting. */
export function isWithDesigner(status: AlbumStatus): boolean {
  return status === "in_design" || status === "in_revision";
}

/** True when there is a proof the couple can look at. */
export function hasProof(status: AlbumStatus): boolean {
  return (
    status === "proof_ready" ||
    status === "in_revision" ||
    status === "approved" ||
    status === "ordered" ||
    status === "shipped"
  );
}

/** Legacy predicate: true only for AI-era albums the old editor may still open. */
export function isEditable(status: AlbumStatus): boolean {
  return status === "ready";
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
  briefing: "Tell us the look.",
  in_design: "Your designer is on it.",
  proof_ready: "Your proof is ready.",
  in_revision: "Your notes are with your designer.",
  approved: "Approved. Ready to order.",
  analyzing: "Reading your photos.",
  generating: "Designing your album.",
  ready: "Ready to view.",
  ordered: "Ordered. We're on it.",
  shipped: "On its way.",
};

export function statusCopy(status: AlbumStatus): string {
  return STATUS_COPY[status];
}
