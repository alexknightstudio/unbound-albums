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
 * Accepted types.
 *
 * HEIC matters: it's what iPhones shoot by default. Note that iOS Safari often
 * transcodes HEIC to JPEG when a photo is picked through a file input, so many
 * "iPhone uploads" arrive as image/jpeg — but not all, and not on every path,
 * so we must accept the real thing too.
 *
 * Some browsers report an empty MIME type for .heic. Extension is checked as a
 * fallback for exactly that reason.
 */
export const ACCEPTED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "image/heic-sequence",
  "image/heif-sequence",
] as const;

export const ACCEPTED_EXTENSIONS = [
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".heic",
  ".heif",
] as const;

/**
 * The file input's accept attribute. Deliberately just "image/*".
 *
 * DO NOT list image/heic here, however sensible that looks. Since WebKit
 * 0f7604 (2024), iOS Safari transcodes photo-library picks only when accept
 * *explicitly restricts* the type set — and naming HEIC flips it the wrong way:
 * Safari then re-encodes the couple's JPEGs and PNGs INTO HEIC, renaming the
 * files and changing their MIME types on the way in. WordPress 6.7 shipped
 * accept="image/heic" and broke exactly this.
 *
 * With "image/*", iOS hands over the untouched HEIC original — which is also the
 * better print master, since the transcoded alternative is a re-encode.
 *
 * checkFile() still validates what actually arrives; this attribute only steers
 * the picker.
 */
export const FILE_INPUT_ACCEPT = "image/*";

export type RejectionReason =
  | "too-large"
  | "wrong-type"
  | "empty";

export type FileCheck =
  | { ok: true }
  | { ok: false; reason: RejectionReason; message: string };

function hasAcceptedExtension(name: string): boolean {
  const lower = name.toLowerCase();
  return ACCEPTED_EXTENSIONS.some((ext) => lower.endsWith(ext));
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
