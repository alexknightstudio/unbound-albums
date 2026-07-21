"use server";

import { randomUUID } from "node:crypto";

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
