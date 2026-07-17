/**
 * The layout engine. Pure — no UI imports, no DB calls, no SDK.
 *
 * The model proposes a plan (via the layout prompt); this module is the
 * contract that decides whether the plan is fit to persist. Every rule the
 * database can't express — slot completeness, orientation fit, no photo used
 * twice, full accounting of every photo — is enforced here, before a write is
 * attempted. A plan that fails validation is regenerated, never patched into
 * the database.
 */

import {
  TEMPLATES_BY_CODE,
  slotAcceptsPhoto,
} from "./templates";

import type { Orientation } from "@/lib/photos/thumbnails";

/** The minimum the engine needs to know about a photo. */
export type EnginePhoto = {
  id: string;
  orientation: Orientation;
};

/** One spread as the model proposed it. */
export type ProposedSpread = {
  template_code: string;
  assignments: Array<{ slot_id: string; photo_id: string }>;
  note?: string;
};

export type ProposedPlan = {
  spreads: ProposedSpread[];
  set_aside: Array<{ photo_id: string; reason: string }>;
};

/** A spread in the shape the database stores. */
export type ValidatedSpread = {
  template_code: string;
  position: number;
  slots: Record<string, string>;
};

export type ValidationResult =
  | { ok: true; spreads: ValidatedSpread[] }
  | { ok: false; errors: string[] };

/**
 * How many spreads an album should aim for. 15 is the album (flat price,
 * v2 decision 2026-07-16): a 150-photo upload gets aggressively curated —
 * that's the product promise — rather than diluted across 30 spreads.
 * Smaller uploads scale down but never below the minimum a book needs to
 * feel like a book. Keep in sync with BASE_SPREAD_COUNT in albums/sizes.ts.
 */
export const MAX_SPREADS = 15;
export const MIN_SPREADS = 3;
export const PHOTOS_PER_SPREAD = 5;

export function spreadTargetFor(photoCount: number): number {
  const raw = Math.round(photoCount / PHOTOS_PER_SPREAD);
  return Math.max(MIN_SPREADS, Math.min(MAX_SPREADS, raw));
}

/**
 * Validate a proposed plan against the template contract and the album's
 * actual photos. Collects every error rather than stopping at the first —
 * the full list feeds the regeneration prompt so the model can fix
 * everything in one pass.
 */
export function validatePlan(
  plan: ProposedPlan,
  photos: readonly EnginePhoto[],
): ValidationResult {
  const errors: string[] = [];
  const photosById = new Map(photos.map((p) => [p.id, p]));
  const usedPhotoIds = new Set<string>();

  if (plan.spreads.length === 0) {
    return { ok: false, errors: ["The plan has no spreads."] };
  }

  const validated: ValidatedSpread[] = [];

  plan.spreads.forEach((spread, i) => {
    const where = `Spread ${i + 1} (${spread.template_code})`;
    const template = TEMPLATES_BY_CODE.get(spread.template_code);

    if (!template) {
      errors.push(`${where}: unknown template code.`);
      return;
    }

    const expectedSlots = new Set(template.slots.map((s) => s.id));
    const seenSlots = new Set<string>();
    const slots: Record<string, string> = {};

    for (const { slot_id, photo_id } of spread.assignments) {
      if (!expectedSlots.has(slot_id)) {
        errors.push(`${where}: slot "${slot_id}" does not exist.`);
        continue;
      }
      if (seenSlots.has(slot_id)) {
        errors.push(`${where}: slot "${slot_id}" filled twice.`);
        continue;
      }
      seenSlots.add(slot_id);

      const photo = photosById.get(photo_id);
      if (!photo) {
        errors.push(`${where}: photo ${photo_id} is not in this album.`);
        continue;
      }
      if (usedPhotoIds.has(photo_id)) {
        errors.push(`${where}: photo ${photo_id} is already used elsewhere.`);
        continue;
      }
      usedPhotoIds.add(photo_id);

      const slotDef = template.slots.find((s) => s.id === slot_id);
      if (slotDef && !slotAcceptsPhoto(slotDef.accepts, photo.orientation)) {
        errors.push(
          `${where}: slot "${slot_id}" needs ${slotDef.accepts}, got ${photo.orientation} (${photo_id}).`,
        );
        continue;
      }

      slots[slot_id] = photo_id;
    }

    for (const slotId of expectedSlots) {
      if (!seenSlots.has(slotId)) {
        errors.push(`${where}: slot "${slotId}" was left empty.`);
      }
    }

    validated.push({
      template_code: spread.template_code,
      position: i + 1,
      slots,
    });
  });

  // Set-asides: must be real photos, not also placed on a spread.
  const setAsideIds = new Set<string>();
  for (const { photo_id } of plan.set_aside) {
    if (!photosById.has(photo_id)) {
      errors.push(`Set-aside photo ${photo_id} is not in this album.`);
      continue;
    }
    if (usedPhotoIds.has(photo_id)) {
      errors.push(`Photo ${photo_id} is both placed and set aside.`);
      continue;
    }
    setAsideIds.add(photo_id);
  }

  // Full accounting: every photo is either on a spread or set aside with a
  // reason. A photo that silently vanishes is a broken promise to the couple.
  for (const photo of photos) {
    if (!usedPhotoIds.has(photo.id) && !setAsideIds.has(photo.id)) {
      errors.push(`Photo ${photo.id} is neither placed nor set aside.`);
    }
  }

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, spreads: validated };
}
