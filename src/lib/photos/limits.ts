/**
 * Upload rules.
 *
 * CLAUDE.md locks these: curated upload of ~150 photos, hard cap 200. The cap is
 * enforced here and in the upload path rather than by a database trigger — a
 * counting trigger races under parallel uploads, and the failure mode (a 201st
 * photo) doesn't justify the locking. See DECISIONS.md.
 */

/** What we ask couples for. */
export const TARGET_PHOTO_COUNT = 150;

/** What we refuse to exceed. */
export const MAX_PHOTO_COUNT = 200;

/**
 * Concurrent uploads. CLAUDE.md says 2–3: more saturates a phone's uplink and
 * makes every file slower, which on a flaky connection means more of them time
 * out at once.
 */
export const UPLOAD_CONCURRENCY = 3;

/** Retries per file before we surface a failure to the couple. */
export const UPLOAD_MAX_RETRIES = 3;

/**
 * Refuse absurd files early. A 200MB "photo" is a mistake — a video, a PSD —
 * and finding out after a long upload on cellular is the worst time to learn.
 */
export const MAX_FILE_BYTES = 75 * 1024 * 1024;

/**
 * Accepted types. Deliberately excludes HEIC — see FILE_INPUT_ACCEPT below.
 */
export const ACCEPTED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export const ACCEPTED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp"] as const;

/** Recognised so we can explain the problem instead of saying "not a photo". */
const HEIC_MIME_TYPES = [
  "image/heic",
  "image/heif",
  "image/heic-sequence",
  "image/heif-sequence",
] as const;

const HEIC_EXTENSIONS = [".heic", ".heif"] as const;

/**
 * The file input's accept attribute — and it is load-bearing, not cosmetic.
 *
 * Since WebKit 0f7604 (2024), iOS Safari transcodes photo-library picks to JPEG
 * ONLY when accept explicitly restricts the type set. Listing the types below is
 * what makes an iPhone hand us JPEG instead of HEIC. Widening this to "image/*"
 * would silently start delivering raw HEIC, which nothing downstream can decode:
 * not sharp on Vercel (prebuilt binaries omit libheif over HEVC licensing), not
 * Supabase Edge Functions (2s CPU limit), and not Claude's vision API.
 *
 * Never add image/heic here. That inverts the behaviour again and makes Safari
 * re-encode the couple's JPEGs and PNGs INTO HEIC on the way in.
 *
 * The tradeoff, chosen deliberately: we store Apple's re-encode rather than the
 * camera original. See DECISIONS.md. Revisit if we ever move to Supabase Pro,
 * whose Storage transformations decode HEIC.
 */
export const FILE_INPUT_ACCEPT = ACCEPTED_MIME_TYPES.join(",");

export type RejectionReason = "too-large" | "wrong-type" | "heic" | "empty";

export type FileCheck =
  | { ok: true }
  | { ok: false; reason: RejectionReason; message: string };

function hasAcceptedExtension(name: string): boolean {
  const lower = name.toLowerCase();
  return ACCEPTED_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

/**
 * HEIC still reaches us despite the accept attribute: drag-and-drop ignores
 * accept entirely, and iOS's Files picker hands bytes over as-is.
 */
function isHeic(file: { name: string; type: string }): boolean {
  const lower = file.name.toLowerCase();
  return (
    (HEIC_MIME_TYPES as readonly string[]).includes(file.type.toLowerCase()) ||
    HEIC_EXTENSIONS.some((ext) => lower.endsWith(ext))
  );
}

/**
 * Type is judged by MIME *or* extension, not both. Browsers disagree about HEIC's
 * MIME type and some send nothing at all; rejecting on that would refuse valid
 * iPhone photos.
 */
export function checkFile(file: {
  name: string;
  size: number;
  type: string;
}): FileCheck {
  if (file.size === 0) {
    return {
      ok: false,
      reason: "empty",
      message: `${file.name} is empty.`,
    };
  }

  if (file.size > MAX_FILE_BYTES) {
    return {
      ok: false,
      reason: "too-large",
      message: `${file.name} is too big. Photos need to be under ${Math.floor(
        MAX_FILE_BYTES / (1024 * 1024),
      )}MB.`,
    };
  }

  // Checked before the general type check so an iPhone photo gets an answer it
  // can act on rather than "isn't a photo we can use" — which, for a photo, is
  // both wrong-sounding and useless.
  if (isHeic(file)) {
    return {
      ok: false,
      reason: "heic",
      message: `${file.name} is an iPhone HEIC file. Pick it from your photo library instead of Files and your phone will convert it for us.`,
    };
  }

  const mimeOk = (ACCEPTED_MIME_TYPES as readonly string[]).includes(
    file.type.toLowerCase(),
  );

  if (!mimeOk && !hasAcceptedExtension(file.name)) {
    return {
      ok: false,
      reason: "wrong-type",
      message: `${file.name} isn't a photo we can use.`,
    };
  }

  return { ok: true };
}

export type SelectionCheck = {
  /** Files to upload, already trimmed to the cap. */
  accepted: number;
  /** Files refused because the album is full. */
  overflow: number;
  /** True if the album is already at the cap. */
  full: boolean;
};

/** How many of an incoming batch will fit, given what's already uploaded. */
export function checkSelection(
  existingCount: number,
  incomingCount: number,
): SelectionCheck {
  const room = Math.max(0, MAX_PHOTO_COUNT - existingCount);
  const accepted = Math.min(incomingCount, room);
  return {
    accepted,
    overflow: incomingCount - accepted,
    full: room === 0,
  };
}
