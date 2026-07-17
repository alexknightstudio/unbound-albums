"use server";

import { revalidatePath } from "next/cache";

import { COVER_LAYOUT_STYLES, type CoverLayoutStyle } from "@/lib/albums/cover";
import {
  assignPhotosToTemplate,
  validateSpreadSlots,
} from "@/lib/engine/editing";
import { TEMPLATES_BY_CODE } from "@/lib/engine/templates";
import { createClient } from "@/lib/supabase/server";

import type { EnginePhoto } from "@/lib/engine/engine";

export type EditActionState = { ok: boolean; error?: string };

type SpreadRow = {
  id: string;
  album_id: string;
  template_code: string;
  slots: Record<string, string>;
};

/**
 * Every editor mutation starts the same way: the couple's own client (RLS
 * decides ownership), the album must be editable (status "ready"), and the
 * edit must pass the engine's validation before a row changes. Returns
 * everything the specific action needs, or an error message.
 */
async function loadEditContext(spreadId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." } as const;

  const { data: spread } = await supabase
    .from("spreads")
    .select("id, album_id, template_code, slots")
    .eq("id", spreadId)
    .maybeSingle<SpreadRow>();
  if (!spread) return { error: "Not found." } as const;

  const { data: album } = await supabase
    .from("albums")
    .select("id, status")
    .eq("id", spread.album_id)
    .maybeSingle<{ id: string; status: string }>();
  if (!album) return { error: "Not found." } as const;
  if (album.status !== "ready") {
    return { error: "This album can't be edited right now." } as const;
  }

  const [{ data: photos }, { data: otherSpreads }] = await Promise.all([
    supabase
      .from("photos")
      .select("id, orientation")
      .eq("album_id", album.id)
      .returns<Array<{ id: string; orientation: EnginePhoto["orientation"] | null }>>(),
    supabase
      .from("spreads")
      .select("id, slots")
      .eq("album_id", album.id)
      .neq("id", spread.id)
      .returns<Array<{ id: string; slots: Record<string, string> }>>(),
  ]);

  const enginePhotos: EnginePhoto[] = (photos ?? []).map((p) => ({
    id: p.id,
    orientation: p.orientation ?? "landscape",
  }));
  const usedElsewhere = new Set<string>(
    (otherSpreads ?? []).flatMap((s) => Object.values(s.slots)),
  );

  return { supabase, spread, album, enginePhotos, usedElsewhere } as const;
}

/** Replace one spread's slot assignments (swap, place, remove). */
export async function saveSpreadSlots(
  spreadId: string,
  slots: Record<string, string>,
): Promise<EditActionState> {
  const ctx = await loadEditContext(spreadId);
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const result = validateSpreadSlots(
    ctx.spread.template_code,
    slots,
    ctx.enginePhotos,
    ctx.usedElsewhere,
  );
  if (!result.ok) return { ok: false, error: result.error };

  const { error } = await ctx.supabase
    .from("spreads")
    .update({ slots: result.slots })
    .eq("id", spreadId);
  if (error) return { ok: false, error: "Could not save." };

  revalidatePath(`/albums/${ctx.album.id}/edit`);
  return { ok: true };
}

/** Switch a spread to a compatible template, remapping its photos. */
export async function changeSpreadTemplate(
  spreadId: string,
  templateCode: string,
): Promise<EditActionState> {
  const ctx = await loadEditContext(spreadId);
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const template = TEMPLATES_BY_CODE.get(templateCode);
  if (!template) return { ok: false, error: "Unknown template." };

  const photosById = new Map(ctx.enginePhotos.map((p) => [p.id, p]));
  const currentTemplate = TEMPLATES_BY_CODE.get(ctx.spread.template_code);
  // Preserve the current visual order: emphasis slot first, then the
  // template's declared slot order — so the strongest photo stays strongest.
  const orderedSlotIds = currentTemplate
    ? [...currentTemplate.slots]
        .sort((a, b) => Number(b.emphasis ?? false) - Number(a.emphasis ?? false))
        .map((s) => s.id)
    : Object.keys(ctx.spread.slots);
  const currentPhotos = orderedSlotIds
    .map((slotId) => ctx.spread.slots[slotId])
    .filter((id): id is string => Boolean(id))
    .map((id) => photosById.get(id))
    .filter((p): p is EnginePhoto => Boolean(p));

  const assignment = assignPhotosToTemplate(template, currentPhotos);
  if (!assignment) {
    return { ok: false, error: "Those photos don't fit that layout." };
  }

  const { error } = await ctx.supabase
    .from("spreads")
    .update({ template_code: templateCode, slots: assignment })
    .eq("id", spreadId);
  if (error) return { ok: false, error: "Could not save." };

  revalidatePath(`/albums/${ctx.album.id}/edit`);
  return { ok: true };
}

/** Reorder all spreads. `orderedIds` is the complete new order. */
export async function reorderSpreads(
  albumId: string,
  orderedIds: string[],
): Promise<EditActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { data: album } = await supabase
    .from("albums")
    .select("id, status")
    .eq("id", albumId)
    .maybeSingle<{ id: string; status: string }>();
  if (!album) return { ok: false, error: "Not found." };
  if (album.status !== "ready") {
    return { ok: false, error: "This album can't be edited right now." };
  }

  const { data: spreads } = await supabase
    .from("spreads")
    .select("id")
    .eq("album_id", albumId)
    .returns<Array<{ id: string }>>();
  const existing = new Set((spreads ?? []).map((s) => s.id));

  if (
    orderedIds.length !== existing.size ||
    !orderedIds.every((id) => existing.has(id))
  ) {
    return { ok: false, error: "That's not the full album." };
  }

  // Two passes because supabase-js can't hold one transaction across
  // statements: park every position out of the way, then write the final
  // order. Positions are momentarily negative, never duplicated.
  for (const [index, id] of orderedIds.entries()) {
    const { error } = await supabase
      .from("spreads")
      .update({ position: -(index + 1) })
      .eq("id", id);
    if (error) return { ok: false, error: "Could not reorder." };
  }
  for (const [index, id] of orderedIds.entries()) {
    const { error } = await supabase
      .from("spreads")
      .update({ position: index + 1 })
      .eq("id", id);
    if (error) return { ok: false, error: "Could not reorder." };
  }

  revalidatePath(`/albums/${albumId}/edit`);
  return { ok: true };
}

/** Save the cover design. */
export async function saveCover(
  albumId: string,
  cover: {
    hero_photo_id: string;
    title_text: string;
    subtitle_text: string;
    layout_style: CoverLayoutStyle;
  },
): Promise<EditActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  if (!COVER_LAYOUT_STYLES.includes(cover.layout_style)) {
    return { ok: false, error: "Pick a cover style." };
  }
  if (cover.title_text.length > 80 || cover.subtitle_text.length > 120) {
    return { ok: false, error: "That text is a little long for a cover." };
  }

  const { data: photo } = await supabase
    .from("photos")
    .select("id, album_id")
    .eq("id", cover.hero_photo_id)
    .maybeSingle<{ id: string; album_id: string }>();
  if (!photo || photo.album_id !== albumId) {
    return { ok: false, error: "Pick a photo from this album." };
  }

  const { error } = await supabase
    .from("albums")
    .update({
      cover: {
        hero_photo_id: cover.hero_photo_id,
        title_text: cover.title_text.trim(),
        subtitle_text: cover.subtitle_text.trim(),
        layout_style: cover.layout_style,
      },
    })
    .eq("id", albumId)
    .eq("status", "ready");
  if (error) return { ok: false, error: "Could not save." };

  revalidatePath(`/albums/${albumId}/edit`);
  revalidatePath(`/albums/${albumId}`);
  return { ok: true };
}
