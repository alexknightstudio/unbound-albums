import { beforeAll, describe, expect, it } from "vitest";

import {
  hashGalleryPassword,
  makeAccessToken,
  verifyAccessToken,
  verifyGalleryPassword,
} from "./access";

beforeAll(() => {
  process.env.GALLERY_ACCESS_SECRET = "test-secret-not-for-production";
});

describe("gallery passwords", () => {
  it("verifies the right password and rejects the wrong one", () => {
    const stored = hashGalleryPassword("tulum-october");
    expect(verifyGalleryPassword("tulum-october", stored)).toBe(true);
    expect(verifyGalleryPassword("tulum-november", stored)).toBe(false);
    expect(verifyGalleryPassword("", stored)).toBe(false);
  });

  it("salts — the same password hashes differently twice", () => {
    expect(hashGalleryPassword("x")).not.toBe(hashGalleryPassword("x"));
  });

  it("rejects malformed stored values instead of throwing", () => {
    expect(verifyGalleryPassword("x", "garbage")).toBe(false);
    expect(verifyGalleryPassword("x", "")).toBe(false);
  });
});

describe("access tokens", () => {
  const gallery = "11111111-2222-3333-4444-555555555555";

  it("round-trips for the right gallery", () => {
    expect(verifyAccessToken(makeAccessToken(gallery), gallery)).toBe(true);
  });

  it("is scoped — a token for one gallery opens no other", () => {
    const other = "99999999-2222-3333-4444-555555555555";
    expect(verifyAccessToken(makeAccessToken(gallery), other)).toBe(false);
  });

  it("rejects expiry tampering — the signature covers the timestamp", () => {
    const token = makeAccessToken(gallery, 60);
    const [g, exp, mac] = token.split(".");
    const forged = `${g}.${Number(exp) + 999999}.${mac}`;
    expect(verifyAccessToken(forged, gallery)).toBe(false);
  });

  it("rejects expired tokens", () => {
    const token = makeAccessToken(gallery, -10);
    expect(verifyAccessToken(token, gallery)).toBe(false);
  });

  it("rejects junk", () => {
    expect(verifyAccessToken("", gallery)).toBe(false);
    expect(verifyAccessToken("a.b", gallery)).toBe(false);
    expect(verifyAccessToken("a.b.c.d", gallery)).toBe(false);
  });
});
