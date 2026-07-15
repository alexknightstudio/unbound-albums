"use server";

import { redirect } from "next/navigation";

import { isAlbumSize } from "@/lib/albums/sizes";
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
  const size = formData.get("size");

  if (!title) {
    return { status: "error", message: "Give your album a name." };
  }
  if (title.length > 120) {
    return { status: "error", message: "That name is a little long." };
  }
  if (!isAlbumSize(size)) {
    return { status: "error", message: "Choose a size." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // status defaults to 'uploading' — the insert trigger writes the opening entry
  // to album_status_events, so the history is complete from row one.
  const { data, error } = await supabase
    .from("albums")
    .insert({ user_id: user.id, title, size })
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
