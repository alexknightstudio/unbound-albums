"use server";

import { redirect } from "next/navigation";

import { DEFAULT_ALBUM_SIZE } from "@/lib/albums/sizes";
import { createClient } from "@/lib/supabase/server";

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export type CreateAlbumState = {
  status: "idle" | "error";
  message?: string;
};

export async function createAlbum(
  _previous: CreateAlbumState,
  formData: FormData,
): Promise<CreateAlbumState> {
  const title = String(formData.get("title") ?? "").trim();
  const eventDate = String(formData.get("event_date") ?? "").trim();
  const venue = String(formData.get("venue") ?? "").trim();

  if (!title) {
    return { status: "error", message: "Tell us your names." };
  }
  if (title.length > 120) {
    return { status: "error", message: "That's a little long." };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(eventDate)) {
    return { status: "error", message: "Pick your wedding date." };
  }
  if (!venue) {
    return { status: "error", message: "Tell us where it happened." };
  }
  if (venue.length > 160) {
    return { status: "error", message: "Keep the venue under 160 characters." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Size starts at the default and is confirmed in the customizations step —
  // the start form asks who and where, nothing more.
  // status defaults to 'uploading' — the insert trigger writes the opening entry
  // to album_status_events, so the history is complete from row one.
  const { data, error } = await supabase
    .from("albums")
    .insert({
      user_id: user.id,
      title,
      event_date: eventDate,
      venue,
      size: DEFAULT_ALBUM_SIZE,
    })
    .select("id")
    .single();

  if (error || !data) {
    return {
      status: "error",
      message: "We couldn't create that album. Try again.",
    };
  }

  // Outside any try/catch: redirect() works by throwing, and catching it would
  // swallow the navigation.
  redirect(`/albums/${data.id}`);
}
