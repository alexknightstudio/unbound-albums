import {
  createHmac,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";

/**
 * Gallery access control (HOSTING_SPEC.md §3 consequence #1).
 *
 * The slug is the capability; an optional password gates it further. After a
 * correct password, the visitor gets an HMAC-signed cookie scoped to that
 * gallery — no client accounts, nothing guessable, nothing stored server-side.
 * Server-only module.
 */

const KEY_LEN = 64;

export function hashGalleryPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password.normalize(), salt, KEY_LEN).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyGalleryPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const candidate = scryptSync(password.normalize(), salt, KEY_LEN);
  const expected = Buffer.from(hash, "hex");
  return (
    candidate.length === expected.length && timingSafeEqual(candidate, expected)
  );
}

function secret(): string {
  const value = process.env.GALLERY_ACCESS_SECRET;
  if (!value) throw new Error("Missing GALLERY_ACCESS_SECRET in .env.local");
  return value;
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export const GALLERY_ACCESS_COOKIE = (galleryId: string) =>
  `g_access_${galleryId.replaceAll("-", "")}`;

/** Access token: `${galleryId}.${expiresEpochSeconds}.${hmac}`. Default 30
 * days — a couple shares the gallery link with family over weeks, not hours. */
export function makeAccessToken(
  galleryId: string,
  ttlSeconds = 30 * 24 * 60 * 60,
): string {
  const expires = Math.floor(Date.now() / 1000) + ttlSeconds;
  const payload = `${galleryId}.${expires}`;
  return `${payload}.${sign(payload)}`;
}

export function verifyAccessToken(token: string, galleryId: string): boolean {
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [tokenGallery, expiresRaw, mac] = parts;
  if (tokenGallery !== galleryId) return false;
  const expires = Number(expiresRaw);
  if (!Number.isFinite(expires) || expires * 1000 < Date.now()) return false;
  const expected = sign(`${tokenGallery}.${expiresRaw}`);
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
