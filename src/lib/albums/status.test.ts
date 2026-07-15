import { describe, expect, it } from "vitest";

import {
  ALBUM_STATUSES,
  type AlbumStatus,
  canTransition,
  INITIAL_ALBUM_STATUS,
  isAlbumStatus,
  isEditable,
  isOrdered,
  isWorking,
  nextStatuses,
  statusCopy,
} from "./status";

describe("the happy path", () => {
  it("walks uploading → analyzing → generating → ready → ordered → shipped", () => {
    const path: AlbumStatus[] = [
      "uploading",
      "analyzing",
      "generating",
      "ready",
      "ordered",
      "shipped",
    ];

    for (let i = 0; i < path.length - 1; i++) {
      expect(
        canTransition(path[i], path[i + 1]),
        `${path[i]} → ${path[i + 1]} should be legal`,
      ).toBe(true);
    }
  });

  it("starts at uploading", () => {
    expect(INITIAL_ALBUM_STATUS).toBe("uploading");
  });
});

describe("illegal moves", () => {
  it("cannot skip ahead from uploading to ready", () => {
    expect(canTransition("uploading", "ready")).toBe(false);
  });

  it("cannot jump straight to shipped", () => {
    expect(canTransition("uploading", "shipped")).toBe(false);
    expect(canTransition("ready", "shipped")).toBe(false);
  });

  it("cannot un-order an album", () => {
    expect(canTransition("ordered", "ready")).toBe(false);
    expect(canTransition("shipped", "ready")).toBe(false);
  });

  it("cannot go back to uploading once analysis starts", () => {
    for (const status of ALBUM_STATUSES) {
      if (status === "uploading") continue;
      expect(
        canTransition(status, "uploading"),
        `${status} → uploading should be illegal`,
      ).toBe(false);
    }
  });

  it("shipped is terminal", () => {
    expect(nextStatuses("shipped")).toEqual([]);
    for (const status of ALBUM_STATUSES) {
      expect(canTransition("shipped", status)).toBe(false);
    }
  });

  it("no status transitions to itself", () => {
    for (const status of ALBUM_STATUSES) {
      expect(canTransition(status, status), `${status} → itself`).toBe(false);
    }
  });
});

describe("regeneration", () => {
  it("allows ready → generating, the full-album regenerate", () => {
    expect(canTransition("ready", "generating")).toBe(true);
  });

  it("does not allow regenerating an album that has been paid for", () => {
    expect(canTransition("ordered", "generating")).toBe(false);
    expect(canTransition("shipped", "generating")).toBe(false);
  });
});

describe("state predicates", () => {
  it("treats ordered and shipped as ordered", () => {
    expect(isOrdered("ordered")).toBe(true);
    expect(isOrdered("shipped")).toBe(true);
    expect(isOrdered("ready")).toBe(false);
    expect(isOrdered("uploading")).toBe(false);
  });

  it("only allows editing a ready album", () => {
    expect(isEditable("ready")).toBe(true);
    for (const status of ALBUM_STATUSES) {
      if (status === "ready") continue;
      expect(isEditable(status), `${status} should not be editable`).toBe(false);
    }
  });

  it("reports work in progress during analysis and generation", () => {
    expect(isWorking("analyzing")).toBe(true);
    expect(isWorking("generating")).toBe(true);
    expect(isWorking("ready")).toBe(false);
    expect(isWorking("uploading")).toBe(false);
  });
});

describe("guards and copy", () => {
  it("recognises real statuses and rejects junk", () => {
    expect(isAlbumStatus("ready")).toBe(true);
    expect(isAlbumStatus("READY")).toBe(false);
    expect(isAlbumStatus("done")).toBe(false);
    expect(isAlbumStatus(null)).toBe(false);
    expect(isAlbumStatus(7)).toBe(false);
  });

  it("has copy for every status", () => {
    for (const status of ALBUM_STATUSES) {
      expect(statusCopy(status).length).toBeGreaterThan(0);
    }
  });

  it("never shouts — brand voice is periods, not exclamation marks", () => {
    for (const status of ALBUM_STATUSES) {
      expect(statusCopy(status)).not.toContain("!");
    }
  });
});

describe("reachability", () => {
  it("can reach every status from the initial one", () => {
    const seen = new Set<AlbumStatus>([INITIAL_ALBUM_STATUS]);
    const queue: AlbumStatus[] = [INITIAL_ALBUM_STATUS];

    while (queue.length > 0) {
      const current = queue.shift()!;
      for (const next of nextStatuses(current)) {
        if (!seen.has(next)) {
          seen.add(next);
          queue.push(next);
        }
      }
    }

    // A status nobody can reach is a bug — either dead code or a missing edge.
    for (const status of ALBUM_STATUSES) {
      expect(seen.has(status), `${status} is unreachable`).toBe(true);
    }
  });
});
