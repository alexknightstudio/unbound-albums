"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

/**
 * The designer's delivery: a set of finished spread images already uploaded
 * to the proofs bucket becomes a proof round, and the album goes back to the
 * couple. RLS (is_staff) guards every table this touches; the status trigger
 * guards the transition.
 */

export type DeliverState = { status: "idle" | "error"; message?: string };

export async function deliverProof(
  albumId: string,
  storagePaths: string[],
  note: string,
): Promise<DeliverState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "error", message: "Not signed in." };

  const { data: staff } = await supabase
    .from("staff")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle<{ role: string }>();
  if (!staff) return { status: "error", message: "Not yours to deliver." };

  const paths = storagePaths.map((p) => String(p));
  if (paths.length === 0) {
    return { status: "error", message: "Upload the spread images first." };
  }
  if (paths.some((p) => !p.startsWith(`${albumId}/`))) {
    return { status: "error", message: "Those files don't belong to this album." };
  }

  const { data: album } = await supabase
    .from("albums")
    .select("id, status")
    .eq("id", albumId)
    .maybeSingle<{ id: string; status: string }>();
  if (!album) return { status: "error", message: "Album not found." };
  if (album.status !== "in_design" && album.status !== "in_revision") {
    return { status: "error", message: "This album isn't waiting on a proof." };
  }

  const { data: lastProof } = await supabase
    .from("proofs")
    .select("round")
    .eq("album_id", albumId)
    .order("round", { ascending: false })
    .limit(1)
    .maybeSingle<{ round: number }>();
  const round = (lastProof?.round ?? 0) + 1;

  const trimmedNote = note.trim().slice(0, 2000);
  const { data: proof, error: proofError } = await supabase
    .from("proofs")
    .insert({
      album_id: albumId,
      round,
      note: trimmedNote.length > 0 ? trimmedNote : null,
      created_by: user.id,
    })
    .select("id")
    .maybeSingle<{ id: string }>();
  if (proofError || !proof) {
    return { status: "error", message: "Could not create the proof round." };
  }

  const { error: pagesError } = await supabase.from("proof_pages").insert(
    paths.map((storage_path, i) => ({
      proof_id: proof.id,
      position: i + 1,
      storage_path,
    })),
  );
  if (pagesError) {
    return { status: "error", message: "Could not attach the pages. Try again." };
  }

  const { data: moved, error: statusError } = await supabase
    .from("albums")
    .update({ status: "proof_ready", designer_id: user.id })
    .eq("id", albumId)
    .eq("status", album.status)
    .select("id")
    .maybeSingle();
  if (statusError || !moved) {
    return { status: "error", message: "Pages saved, but the handoff failed. Try again." };
  }

  revalidatePath(`/studio/${albumId}`);
  revalidatePath(`/albums/${albumId}`);
  return { status: "idle" };
}
