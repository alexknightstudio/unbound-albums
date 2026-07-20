"use server";

import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { hashGalleryPassword } from "@/lib/galleries/access";
import { createClient } from "@/lib/supabase/server";

export type GalleryActionState = { status: "idle" | "error"; message?: string };

/** Turn a signed-in user into a photographer (the hosting product's account). */
export async function activatePhotographerAccount(
  _prev: GalleryActionState,
  formData: FormData,
): Promise<GalleryActionState> {
  const businessName = String(formData.get("business_name") ?? "").trim();
  if (!businessName) {
    return { status: "error", message: "Tell us your studio's name." };
  }
  if (businessName.length > 120) {
    return { status: "error", message: "Keep the name under 120 characters." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { error } = await supabase
    .from("photographer_accounts")
    .upsert({ user_id: user.id, business_name: businessName });
  if (error) return { status: "error", message: "Could not save. Try again." };

  revalidatePath("/galleries");
  return { status: "idle" };
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
      photographer_id: user.id,
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
