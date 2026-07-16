import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { ALBUM_SIZE_SPECS, type AlbumSize } from "@/lib/albums/sizes";
import { type AlbumStatus, statusCopy } from "@/lib/albums/status";
import { createClient } from "@/lib/supabase/server";

import { PhotoUploader } from "./photo-uploader";

type AlbumRow = {
  id: string;
  title: string;
  status: AlbumStatus;
  size: AlbumSize;
};

export default async function AlbumPage({
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
    .select("id, title, status, size")
    .eq("id", id)
    .maybeSingle<AlbumRow>();

  // RLS makes another couple's album indistinguishable from one that doesn't
  // exist — which is the right answer to give either way.
  if (!album) notFound();

  // head:true fetches the count without dragging 150 rows back for a number.
  const { count } = await supabase
    .from("photos")
    .select("id", { count: "exact", head: true })
    .eq("album_id", album.id);

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-10 px-6 py-16">
      <Link
        href="/albums"
        className="text-xs text-slate transition-colors hover:text-pewter"
      >
        ← All albums
      </Link>

      <header className="flex flex-col gap-3">
        <h1 className="font-display text-5xl text-parchment">{album.title}</h1>
        <p className="text-sm text-pewter">
          {ALBUM_SIZE_SPECS[album.size].label} · {statusCopy(album.status)}
        </p>
      </header>

      <PhotoUploader albumId={album.id} existingCount={count ?? 0} />
    </main>
  );
}
