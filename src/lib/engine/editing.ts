/**
 * Editing rules — pure, like the rest of the engine.
 *
 * The editor lets a couple reshape what the AI proposed. These helpers are
 * the contract that keeps every edit printable: slots stay real, orientation
 * fit is preserved, and no photo appears twice in the album. Empty slots ARE
 * allowed mid-edit (a removed photo leaves deliberate whitespace); Phase 5
 * decides whether an album with empty slots can be ordered.
 */

import {
  TEMPLATES_BY_CODE,
  SPREAD_TEMPLATES,
  slotAcceptsPhoto,
  type SpreadTemplate,
} from "./templates";

import type { EnginePhoto } from "./engine";

export type EditValidation =
  | { ok: true; slots: Record<string, string> }
  | { ok: false; error: string };

/**
 * Validate one spread's edited slots.
 *
 * `usedElsewhere` is every photo_id placed on OTHER spreads — the caller
 * assembles it so this stays pure.
 */
export function validateSpreadSlots(
  templateCode: string,
  slots: Record<string, string>,
  photos: readonly EnginePhoto[],
  usedElsewhere: ReadonlySet<string>,
): EditValidation {
  const template = TEMPLATES_BY_CODE.get(templateCode);
  if (!template) return { ok: false, error: "Unknown template." };

  const validSlotIds = new Set(template.slots.map((s) => s.id));
  const photosById = new Map(photos.map((p) => [p.id, p]));
  const seen = new Set<string>();
  const clean: Record<string, string> = {};

  for (const [slotId, photoId] of Object.entries(slots)) {
    if (!validSlotIds.has(slotId)) {
      return { ok: false, error: `Slot "${slotId}" does not exist.` };
    }
    const photo = photosById.get(photoId);
    if (!photo) {
      return { ok: false, error: "That photo isn't in this album." };
    }
    if (seen.has(photoId) || usedElsewhere.has(photoId)) {
      return { ok: false, error: "That photo is already in the album." };
    }
    seen.add(photoId);

    const slotDef = template.slots.find((s) => s.id === slotId);
    if (slotDef && !slotAcceptsPhoto(slotDef.accepts, photo.orientation)) {
      return {
        ok: false,
        error: `That slot needs a ${slotDef.accepts} photo.`,
      };
    }
    clean[slotId] = photoId;
  }

  return { ok: true, slots: clean };
}

/**
 * Templates a spread could switch to, given the photos currently on it.
 * Compatible = the template has at least as many slots as there are photos,
 * and there's an assignment where every photo fits a distinct slot.
 */
export function compatibleTemplates(
  photos: readonly EnginePhoto[],
): SpreadTemplate[] {
  return SPREAD_TEMPLATES.filter((template) => {
    if (template.slots.length < photos.length) return false;
    return assignPhotosToTemplate(template, photos) !== null;
  });
}

/**
 * The next/previous compatible template for arrow-key cycling. Wraps around;
 * returns null when no other template fits these photos.
 */
export function cycleTemplate(
  currentCode: string,
  photos: readonly EnginePhoto[],
  direction: 1 | -1,
): SpreadTemplate | null {
  const options = compatibleTemplates(photos);
  if (options.length === 0) return null;
  const index = options.findIndex((t) => t.code === currentCode);
  if (index === -1) return options[0];
  if (options.length === 1) return null;
  const next = (index + direction + options.length) % options.length;
  return options[next];
}

/**
 * Greedy assignment of photos into a template: emphasis slots first, most
 * constrained slots before "any", first photo that fits wins. Returns
 * { slot_id: photo_id } or null when no full assignment exists.
 *
 * Greedy is not a full matching algorithm, but with ≤6 slots and three
 * orientation classes it finds an assignment whenever one exists in
 * practice; a miss only hides a template from the picker.
 */
export function assignPhotosToTemplate(
  template: SpreadTemplate,
  photos: readonly EnginePhoto[],
): Record<string, string> | null {
  // Constrained slots claim photos first; emphasis breaks ties so the
  // strongest photo (callers pass it first) lands on the emphasis slot.
  const slots = [...template.slots].sort((a, b) => {
    const constrained = (s: typeof a) => (s.accepts === "any" ? 1 : 0);
    const emphasis = (s: typeof a) => (s.emphasis ? 0 : 1);
    return constrained(a) - constrained(b) || emphasis(a) - emphasis(b);
  });

  const remaining = [...photos];
  const assignment: Record<string, string> = {};

  for (const slot of slots) {
    if (remaining.length === 0) break;
    const index = remaining.findIndex((p) =>
      slotAcceptsPhoto(slot.accepts, p.orientation),
    );
    if (index === -1) {
      // A photo exists but nothing fits this slot; if photos outnumber the
      // slots that can take them, the template is incompatible.
      continue;
    }
    assignment[slot.id] = remaining[index].id;
    remaining.splice(index, 1);
  }

  return remaining.length === 0 ? assignment : null;
}
