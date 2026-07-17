import { notFound, redirect } from "next/navigation";

import { loadAlbumPresentation } from "@/lib/albums/presentation";
import { parseCover } from "@/lib/albums/cover";
import {
  DEFAULT_ALBUM_SIZE,
  isAlbumSize,
} from "@/lib/albums/sizes";
import { createClient } from "@/lib/supabase/server";

import { AlbumEditor, type EditorPhoto } from "./album-editor";

type AlbumRow = {
  id: string;
  title: string;
  status: string;
  size: string;
  cover: unknown;
};

type PhotoRow = {
  id: string;
  orientation: "portrait" | "landscape" | "square" | null;
  set_aside_reason: string | null;
  analysis: {
    hero_potential?: number;
    is_couple_portrait?: boolean;
    stage?: string;
    emotion?: string;
  } | null;
};

export default async function EditAlbumPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: album } = await supabase
    .from("albums")
    .select("id, title, status, size, cover")
    .eq("id", id)
    .maybeSingle<AlbumRow>();
  if (!album) notFound();

  // Only a ready album is editable; anything else goes back to the album
  // page, which knows what to show instead.
  if (album.status !== "ready") redirect(`/albums/${album.id}`);

  const size = isAlbumSize(album.size) ? album.size : DEFAULT_ALBUM_SIZE;
  const presentation = await loadAlbumPresentation(album.id, size);
  if (!presentation) redirect(`/albums/${album.id}`);

  const { data: photoRows } = await supabase
    .from("photos")
    .select("id, orientation, set_aside_reason, analysis")
    .eq("album_id", album.id)
    .order("upload_order", { ascending: true })
    .returns<PhotoRow[]>();

  const photos: EditorPhoto[] = (photoRows ?? []).map((p) => ({
    id: p.id,
    url: presentation.photoUrls[p.id] ?? null,
    orientation: p.orientation ?? "landscape",
    heroPotential: Number(p.analysis?.hero_potential ?? 0),
    isCouplePortrait: Boolean(p.analysis?.is_couple_portrait),
    setAsideReason: p.set_aside_reason,
    stage: String(p.analysis?.stage ?? "other"),
    emotion: String(p.analysis?.emotion ?? "none"),
  }));

  // Full-bleed app shell — the editor owns the whole viewport.
  return (
    <AlbumEditor
      albumId={album.id}
      albumTitle={album.title}
      sizeSpec={presentation.sizeSpec}
      initialSpreads={presentation.spreads}
      photos={photos}
      initialCover={parseCover(album.cover)}
    />
  );
}
