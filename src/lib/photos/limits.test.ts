import { describe, expect, it } from "vitest";

import {
  ACCEPTED_EXTENSIONS,
  checkFile,
  checkSelection,
  FILE_INPUT_ACCEPT,
  MAX_FILE_BYTES,
  MAX_PHOTO_COUNT,
  TARGET_PHOTO_COUNT,
  UPLOAD_CONCURRENCY,
} from "./limits";

const file = (name: string, type: string, size = 3_000_000) => ({
  name,
  type,
  size,
});

describe("locked limits", () => {
  it("targets 150 and caps at 200", () => {
    expect(TARGET_PHOTO_COUNT).toBe(150);
    expect(MAX_PHOTO_COUNT).toBe(200);
  });

  it("uploads 2–3 at a time, per CLAUDE.md", () => {
    expect(UPLOAD_CONCURRENCY).toBeGreaterThanOrEqual(2);
    expect(UPLOAD_CONCURRENCY).toBeLessThanOrEqual(3);
  });
});

describe("checkFile — types", () => {
  it("accepts the formats couples actually have", () => {
    expect(checkFile(file("a.jpg", "image/jpeg")).ok).toBe(true);
    expect(checkFile(file("a.jpeg", "image/jpeg")).ok).toBe(true);
    expect(checkFile(file("a.png", "image/png")).ok).toBe(true);
    expect(checkFile(file("a.webp", "image/webp")).ok).toBe(true);
  });

  it("is case-insensitive about extensions", () => {
    expect(checkFile(file("PHOTO.JPG", "")).ok).toBe(true);
    expect(checkFile(file("PHOTO.JPEG", "")).ok).toBe(true);
  });

  it("refuses things that aren't photos", () => {
    const video = checkFile(file("clip.mov", "video/quicktime", 5_000_000));
    expect(video.ok).toBe(false);
    if (!video.ok) expect(video.reason).toBe("wrong-type");

    expect(checkFile(file("doc.pdf", "application/pdf")).ok).toBe(false);
    expect(checkFile(file("raw.cr2", "image/x-canon-cr2")).ok).toBe(false);
  });

  it("does not accept a video that merely ends in a photo extension mid-name", () => {
    expect(checkFile(file("my.jpg.mov", "video/quicktime")).ok).toBe(false);
  });
});

describe("checkFile — HEIC", () => {
  // We restrict the file input so iOS transcodes to JPEG for us. HEIC still
  // arrives via drag-and-drop (which ignores accept) and iOS's Files picker,
  // so it must be caught and explained rather than decoded.
  it("refuses HEIC by MIME type", () => {
    const result = checkFile(file("IMG_4821.HEIC", "image/heic"));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("heic");
  });

  it("refuses HEIC by extension when the browser reports no MIME type", () => {
    const result = checkFile(file("IMG_4821.HEIC", ""));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("heic");
  });

  it("refuses HEIC when the browser reports a junk MIME type", () => {
    const result = checkFile(file("IMG_4821.heic", "application/octet-stream"));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("heic");
  });

  it("catches HEIF and the sequence variants too", () => {
    expect(checkFile(file("a.heif", "image/heif")).ok).toBe(false);
    expect(checkFile(file("a.x", "image/heic-sequence")).ok).toBe(false);
    expect(checkFile(file("a.x", "image/heif-sequence")).ok).toBe(false);
  });

  it("is case-insensitive", () => {
    expect(checkFile(file("PHOTO.HeIc", "")).ok).toBe(false);
    expect(checkFile(file("photo.HEIF", "")).ok).toBe(false);
  });

  it("tells the couple what to do, rather than calling their photo invalid", () => {
    const result = checkFile(file("IMG_4821.HEIC", "image/heic"));
    if (!result.ok) {
      expect(result.message).toContain("photo library");
      expect(result.message).not.toContain("!");
      // "isn't a photo we can use" is both wrong-sounding and useless here.
      expect(result.message).not.toContain("isn't a photo");
    }
  });
});

describe("FILE_INPUT_ACCEPT", () => {
  // This attribute is what makes iOS Safari transcode HEIC to JPEG. If someone
  // widens it to image/* or adds HEIC, iPhone uploads break in opposite ways —
  // raw HEIC we can't decode, or JPEGs re-encoded INTO HEIC. Both are silent.
  it("never mentions HEIC", () => {
    expect(FILE_INPUT_ACCEPT.toLowerCase()).not.toContain("heic");
    expect(FILE_INPUT_ACCEPT.toLowerCase()).not.toContain("heif");
  });

  it("explicitly restricts the type set rather than using a wildcard", () => {
    expect(FILE_INPUT_ACCEPT).not.toContain("*");
    expect(FILE_INPUT_ACCEPT).toContain("image/jpeg");
  });
});

describe("checkFile — size", () => {
  it("refuses empty files", () => {
    const result = checkFile(file("a.jpg", "image/jpeg", 0));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("empty");
  });

  it("refuses absurd files", () => {
    const result = checkFile(file("a.jpg", "image/jpeg", MAX_FILE_BYTES + 1));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("too-large");
  });

  it("accepts a file exactly at the limit", () => {
    expect(checkFile(file("a.jpg", "image/jpeg", MAX_FILE_BYTES)).ok).toBe(true);
  });

  it("comfortably accepts the real files couples upload", () => {
    // What an iPhone hands us once Safari has transcoded, and a full-res
    // export from a photographer's gallery.
    expect(checkFile(file("IMG_4821.jpg", "image/jpeg", 3_200_000)).ok).toBe(
      true,
    );
    expect(checkFile(file("wedding.jpg", "image/jpeg", 12_000_000)).ok).toBe(
      true,
    );
  });

  it("explains itself without shouting", () => {
    const result = checkFile(file("a.jpg", "image/jpeg", MAX_FILE_BYTES + 1));
    if (!result.ok) {
      expect(result.message).toContain("a.jpg");
      expect(result.message).not.toContain("!");
    }
  });
});

describe("checkSelection — the 200 cap", () => {
  it("accepts a normal batch into an empty album", () => {
    expect(checkSelection(0, 150)).toEqual({
      accepted: 150,
      overflow: 0,
      full: false,
    });
  });

  it("accepts exactly up to the cap", () => {
    expect(checkSelection(0, 200)).toEqual({
      accepted: 200,
      overflow: 0,
      full: false,
    });
  });

  it("trims the overflow rather than refusing the whole batch", () => {
    // Someone selecting 250 should get 200 in, not an error and zero photos.
    expect(checkSelection(0, 250)).toEqual({
      accepted: 200,
      overflow: 50,
      full: false,
    });
  });

  it("accounts for photos already uploaded", () => {
    expect(checkSelection(190, 20)).toEqual({
      accepted: 10,
      overflow: 10,
      full: false,
    });
  });

  it("reports a full album and accepts nothing more", () => {
    expect(checkSelection(200, 5)).toEqual({
      accepted: 0,
      overflow: 5,
      full: true,
    });
  });

  it("never goes negative if an album somehow exceeded the cap", () => {
    const result = checkSelection(205, 5);
    expect(result.accepted).toBe(0);
    expect(result.full).toBe(true);
    expect(result.overflow).toBe(5);
  });

  it("handles an empty selection", () => {
    expect(checkSelection(0, 0)).toEqual({
      accepted: 0,
      overflow: 0,
      full: false,
    });
  });
});

describe("accepted extensions", () => {
  it("all start with a dot and are lowercase", () => {
    for (const ext of ACCEPTED_EXTENSIONS) {
      expect(ext.startsWith(".")).toBe(true);
      expect(ext).toBe(ext.toLowerCase());
    }
  });
});
