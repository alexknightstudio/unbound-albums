"use server";

import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { hashGalleryPassword } from "@/lib/galleries/access";
import { createClient } from "@/lib/supabase/server";

export type GalleryActionState = { status: "idle" | "error"; message?: string };

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function createGallery(
  _prev: GalleryActionState,
  formData: FormData,
): Promise<GalleryActionState> {
  const title = String(formData.get("title") ?? "").trim();
  const eventDate = String(formData.get("event_date") ?? "").trim();
  const password = String(formData.get("password") ?? "").trim();

  if (!title) return { status: "error", message: "Name the gallery." };
  if (title.length > 160) return { status: "error", message: "That title runs long." };
  if (eventDate && !/^\d{4}-\d{2}-\d{2}$/.test(eventDate)) {
    return { status: "error", message: "That date didn't parse." };
  }
  if (password && password.length < 4) {
    return { status: "error", message: "Passwords need at least 4 characters." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data, error } = await supabase
    .from("galleries")
    .insert({
      owner_id: user.id,
      title,
      slug: randomUUID().replaceAll("-", ""),
      event_date: eventDate || null,
      password_hash: password ? hashGalleryPassword(password) : null,
    })
    .select("id")
    .single();
  if (error || !data) {
    return { status: "error", message: "Could not create the gallery. Try again." };
  }

  redirect(`/galleries/${data.id}`);
}

const VISIBILITIES = ["private", "unlisted", "public"] as const;
export type Visibility = (typeof VISIBILITIES)[number];

/** Flip a gallery between private / unlisted / public (PLATFORM_SPEC §4). */
export async function setGalleryVisibility(
  galleryId: string,
  visibility: string,
): Promise<GalleryActionState> {
  if (!(VISIBILITIES as readonly string[]).includes(visibility)) {
    return { status: "error", message: "Pick a visibility." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  if (visibility === "public") {
    // Public galleries appear on the owner's profile — a handle must exist.
    const { data: account } = await supabase
      .from("accounts")
      .select("handle")
      .eq("user_id", user.id)
      .maybeSingle<{ handle: string | null }>();
    if (!account?.handle) {
      return {
        status: "error",
        message: "Claim your @handle first — public galleries live on your profile.",
      };
    }
  }

  const { data, error } = await supabase
    .from("galleries")
    .update({
      visibility,
      indexed_at: visibility === "public" ? new Date().toISOString() : null,
    })
    .eq("id", galleryId)
    .select("id")
    .maybeSingle();
  if (error || !data) return { status: "error", message: "Could not save. Try again." };

  revalidatePath(`/galleries/${galleryId}`);
  return { status: "idle" };
}

/** Claim the public @handle (optional until first publish — spec §12 Q4). */
export async function claimHandle(handleRaw: string): Promise<GalleryActionState> {
  const handle = handleRaw.trim().toLowerCase().replace(/^@/, "");
  if (!/^[a-z0-9][a-z0-9-]{2,29}$/.test(handle)) {
    return {
      status: "error",
      message: "Handles are 3–30 characters: letters, numbers, dashes.",
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { error } = await supabase
    .from("accounts")
    .update({ handle })
    .eq("user_id", user.id);
  if (error) {
    return {
      status: "error",
      message:
        error.code === "23505" ? "That handle is taken." : "Could not save. Try again.",
    };
  }
  return { status: "idle" };
}
