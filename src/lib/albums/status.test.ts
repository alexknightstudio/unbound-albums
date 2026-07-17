import { describe, expect, it } from "vitest";

import {
  ALBUM_STATUSES,
  type AlbumStatus,
  canTransition,
  hasProof,
  INITIAL_ALBUM_STATUS,
  isAlbumStatus,
  isEditable,
  isOrdered,
  isWithDesigner,
  LIVE_STATUSES,
  nextStatuses,
  statusCopy,
} from "./status";

describe("the happy path", () => {
  it("walks uploading → briefing → in_design → proof_ready → approved → ordered → shipped", () => {
    const path: AlbumStatus[] = [
      "uploading",
      "briefing",
      "in_design",
      "proof_ready",
      "approved",
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

describe("the revision loop", () => {
  it("allows proof_ready → in_revision → proof_ready, any number of times", () => {
    expect(canTransition("proof_ready", "in_revision")).toBe(true);
    expect(canTransition("in_revision", "proof_ready")).toBe(true);
  });

  it("cannot approve while the designer is working", () => {
    expect(canTransition("in_design", "approved")).toBe(false);
    expect(canTransition("in_revision", "approved")).toBe(false);
  });

  it("cannot revise after approval", () => {
    expect(canTransition("approved", "in_revision")).toBe(false);
    expect(canTransition("approved", "proof_ready")).toBe(false);
  });
});

describe("illegal moves", () => {
  it("cannot skip the brief", () => {
    expect(canTransition("uploading", "in_design")).toBe(false);
    expect(canTransition("uploading", "proof_ready")).toBe(false);
  });

  it("cannot jump straight to shipped", () => {
    expect(canTransition("uploading", "shipped")).toBe(false);
    expect(canTransition("proof_ready", "shipped")).toBe(false);
  });

  it("cannot order an unapproved album", () => {
    expect(canTransition("proof_ready", "ordered")).toBe(false);
    expect(canTransition("in_design", "ordered")).toBe(false);
  });

  it("cannot un-order an album", () => {
    expect(canTransition("ordered", "approved")).toBe(false);
    expect(canTransition("shipped", "approved")).toBe(false);
  });

  it("cannot go back to uploading once the brief starts", () => {
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

describe("the legacy AI path (2026-07-17 pivot)", () => {
  it("has no way in — no live status transitions into it", () => {
    for (const from of LIVE_STATUSES) {
      for (const legacy of ["analyzing", "generating", "ready"] as const) {
        expect(
          canTransition(from, legacy),
          `${from} → ${legacy} should be illegal after the pivot`,
        ).toBe(false);
      }
    }
  });

  it("still lets a legacy ready album be ordered", () => {
    expect(canTransition("ready", "ordered")).toBe(true);
  });

  it("strands mid-pipeline legacy states deliberately", () => {
    expect(nextStatuses("analyzing")).toEqual([]);
    expect(nextStatuses("generating")).toEqual([]);
  });
});

describe("state predicates", () => {
  it("treats ordered and shipped as ordered", () => {
    expect(isOrdered("ordered")).toBe(true);
    expect(isOrdered("shipped")).toBe(true);
    expect(isOrdered("approved")).toBe(false);
    expect(isOrdered("uploading")).toBe(false);
  });

  it("knows when the album sits with the designer", () => {
    expect(isWithDesigner("in_design")).toBe(true);
    expect(isWithDesigner("in_revision")).toBe(true);
    expect(isWithDesigner("proof_ready")).toBe(false);
    expect(isWithDesigner("briefing")).toBe(false);
  });

  it("knows when a proof exists to show", () => {
    expect(hasProof("proof_ready")).toBe(true);
    expect(hasProof("in_revision")).toBe(true);
    expect(hasProof("approved")).toBe(true);
    expect(hasProof("ordered")).toBe(true);
    expect(hasProof("shipped")).toBe(true);
    expect(hasProof("in_design")).toBe(false);
    expect(hasProof("briefing")).toBe(false);
    expect(hasProof("uploading")).toBe(false);
  });

  it("only the legacy ready state is editable", () => {
    expect(isEditable("ready")).toBe(true);
    for (const status of ALBUM_STATUSES) {
      if (status === "ready") continue;
      expect(isEditable(status), `${status} should not be editable`).toBe(false);
    }
  });
});

describe("guards and copy", () => {
  it("recognises real statuses and rejects junk", () => {
    expect(isAlbumStatus("proof_ready")).toBe(true);
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
  it("can reach every live status from the initial one", () => {
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

    for (const status of LIVE_STATUSES) {
      expect(seen.has(status), `${status} is unreachable`).toBe(true);
    }

    // And the legacy path is exactly what's unreachable — nothing else.
    const unreachable = ALBUM_STATUSES.filter((s) => !seen.has(s));
    expect(unreachable.sort()).toEqual(["analyzing", "generating", "ready"]);
  });
});
