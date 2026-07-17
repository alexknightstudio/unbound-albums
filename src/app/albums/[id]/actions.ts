"use server";

import { revalidatePath } from "next/cache";

import { parseBrief } from "@/lib/albums/brief";
import { createClient } from "@/lib/supabase/server";

/**
 * The couple's side of the designed-for-you flow. Every transition is guarded
 * twice: an optimistic status check in the WHERE clause here, and the status
 * machine trigger in the database that no code path can bypass.
 */

export type ActionState = { status: "idle" | "error"; message?: string };

const IDLE: ActionState = { status: "idle" };

async function ownAlbum(albumId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, album: null };
  const { data: album } = await supabase
    .from("albums")
    .select("id, status, user_id")
    .eq("id", albumId)
    .maybeSingle<{ id: string; status: string; user_id: string }>();
  // RLS already scopes to owner-or-staff; the explicit owner check keeps a
  // staff session from acting as the couple by accident.
  if (!album || album.user_id !== user.id) return { supabase, album: null };
  return { supabase, album };
}

/** "That's everything." Photos are in; time to talk style. */
export async function finishUploading(albumId: string): Promise<ActionState> {
  const { supabase, album } = await ownAlbum(albumId);
  if (!album) return { status: "error", message: "Album not found." };
  if (album.status !== "uploading") return IDLE;

  const { count } = await supabase
    .from("photos")
    .select("id", { count: "exact", head: true })
    .eq("album_id", albumId);
  if (!count || count < 1) {
    return { status: "error", message: "Add your photos first." };
  }

  const { data, error } = await supabase
    .from("albums")
    .update({ status: "briefing" })
    .eq("id", albumId)
    .eq("status", "uploading")
    .select("id")
    .maybeSingle();
  if (error || !data) return { status: "error", message: "Could not save. Try again." };

  revalidatePath(`/albums/${albumId}`);
  return IDLE;
}

/** The brief lands and the album joins the designers' queue in one move. */
export async function submitBrief(
  albumId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = parseBrief({
    cover_material: formData.get("cover_material"),
    cover_color: formData.get("cover_color"),
    cameo: formData.get("cameo"),
    font_style: formData.get("font_style"),
    mood: formData.get("mood"),
    title_text: formData.get("title_text"),
    notes: formData.get("notes"),
  });
  if (!parsed.ok) return { status: "error", message: parsed.message };

  const { supabase, album } = await ownAlbum(albumId);
  if (!album) return { status: "error", message: "Album not found." };

  const { data, error } = await supabase
    .from("albums")
    .update({ brief: parsed.brief, status: "in_design" })
    .eq("id", albumId)
    .eq("status", "briefing")
    .select("id")
    .maybeSingle();
  if (error || !data) return { status: "error", message: "Could not save. Try again." };

  revalidatePath(`/albums/${albumId}`);
  return IDLE;
}

export type RevisionNoteInput = {
  /** 1-based proof page the note is about; null means the whole album. */
  position: number | null;
  note: string;
};

/** Send the couple's notes back to the designer. */
export async function requestRevisions(
  albumId: string,
  proofId: string,
  notes: RevisionNoteInput[],
): Promise<ActionState> {
  const cleaned = notes
    .map((n) => ({
      position:
        typeof n.position === "number" && Number.isInteger(n.position) && n.position >= 1
          ? n.position
          : null,
      note: String(n.note ?? "").trim().slice(0, 2000),
    }))
    .filter((n) => n.note.length > 0);
  if (cleaned.length === 0) {
    return { status: "error", message: "Tell us what to change first." };
  }

  const { supabase, album } = await ownAlbum(albumId);
  if (!album) return { status: "error", message: "Album not found." };
  if (album.status !== "proof_ready") {
    return { status: "error", message: "This proof isn't open for notes right now." };
  }

  // The proof must belong to this album — a note on someone else's proof id
  // would fail RLS anyway, but failing loudly here beats a silent no-op.
  const { data: proof } = await supabase
    .from("proofs")
    .select("id, album_id")
    .eq("id", proofId)
    .maybeSingle<{ id: string; album_id: string }>();
  if (!proof || proof.album_id !== albumId) {
    return { status: "error", message: "That proof doesn't match this album." };
  }

  const { error: insertError } = await supabase.from("revision_notes").insert(
    cleaned.map((n) => ({
      proof_id: proofId,
      position: n.position,
      note: n.note,
    })),
  );
  if (insertError) return { status: "error", message: "Could not send your notes. Try again." };

  const { data, error } = await supabase
    .from("albums")
    .update({ status: "in_revision" })
    .eq("id", albumId)
    .eq("status", "proof_ready")
    .select("id")
    .maybeSingle();
  if (error || !data) return { status: "error", message: "Could not send your notes. Try again." };

  revalidatePath(`/albums/${albumId}`);
  return IDLE;
}

/** The couple signs off. */
export async function approveProof(albumId: string): Promise<ActionState> {
  const { supabase, album } = await ownAlbum(albumId);
  if (!album) return { status: "error", message: "Album not found." };

  const { data, error } = await supabase
    .from("albums")
    .update({ status: "approved" })
    .eq("id", albumId)
    .eq("status", "proof_ready")
    .select("id")
    .maybeSingle();
  if (error || !data) return { status: "error", message: "Could not approve. Try again." };

  revalidatePath(`/albums/${albumId}`);
  return IDLE;
}
