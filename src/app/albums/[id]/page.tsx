/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { AlbumViewer } from "@/components/album/album-viewer";
import { loadAlbumPresentation } from "@/lib/albums/presentation";
import {
  ALBUM_SIZE_SPECS,
  DEFAULT_ALBUM_SIZE,
  isAlbumSize,
} from "@/lib/albums/sizes";
import { type AlbumStatus, statusCopy } from "@/lib/albums/status";
import { createClient } from "@/lib/supabase/server";

import { AnalysisRunner } from "./analysis-runner";
import { PhotoUploader } from "./photo-uploader";

type AlbumRow = {
  id: string;
  title: string;
  status: AlbumStatus;
  size: string;
  share_slug: string;
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
    .select("id, title, status, size, share_slug")
    .eq("id", id)
    .maybeSingle<AlbumRow>();

  // RLS makes another couple's album indistinguishable from one that doesn't
  // exist — which is the right answer to give either way.
  if (!album) notFound();

  const size = isAlbumSize(album.size) ? album.size : DEFAULT_ALBUM_SIZE;

  // head:true fetches the count without dragging 150 rows back for a number.
  const { count } = await supabase
    .from("photos")
    .select("id", { count: "exact", head: true })
    .eq("album_id", album.id);

  const presentation =
    album.status === "ready" || album.status === "ordered" || album.status === "shipped"
      ? await loadAlbumPresentation(album.id, size)
      : null;

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-10 px-6 py-16">
      <Link
        href="/albums"
        className="text-xs text-slate transition-colors hover:text-pewter"
      >
        ← All albums
      </Link>

      <header className="flex flex-col gap-3">
        <h1 className="font-display text-5xl text-parchment">{album.title}</h1>
        <p className="text-sm text-pewter">
          {ALBUM_SIZE_SPECS[size].label} · {statusCopy(album.status)}
        </p>
      </header>

      {album.status === "uploading" ? (
        <PhotoUploader albumId={album.id} existingCount={count ?? 0} />
      ) : null}

      {album.status === "uploading" ||
      album.status === "analyzing" ||
      album.status === "generating" ? (
        <AnalysisRunner
          albumId={album.id}
          albumStatus={album.status}
          photoCount={count ?? 0}
        />
      ) : null}

      {presentation ? (
        <section className="flex flex-col gap-8">
          <AlbumViewer
            spreads={presentation.spreads}
            photoUrls={presentation.photoUrls}
            sizeSpec={presentation.sizeSpec}
          />

          {album.status === "ready" ? (
            <Link
              href={`/albums/${album.id}/edit`}
              className="self-start rounded-md bg-parchment px-6 py-3 text-sm text-ink transition-opacity hover:opacity-90"
            >
              Make it yours
            </Link>
          ) : null}

          <p className="text-xs text-slate">
            Share it:{" "}
            <Link
              href={`/a/${album.share_slug}`}
              className="text-pewter underline-offset-4 transition-colors hover:text-parchment hover:underline"
            >
              a private link anyone can open
            </Link>
            . No account needed.
          </p>

          {presentation.setAside.length > 0 ? (
            <div className="flex flex-col gap-3 rounded-md border border-stone p-4">
              <h3 className="text-sm text-parchment">We set these aside.</h3>
              <ul className="flex flex-col gap-3">
                {presentation.setAside.map((photo) => (
                  <li key={photo.id} className="flex items-center gap-3">
                    {photo.url ? (
                      <img
                        src={photo.url}
                        alt=""
                        className="h-14 w-14 rounded-sm object-cover"
                      />
                    ) : (
                      <div className="h-14 w-14 rounded-sm bg-stone" />
                    )}
                    <span className="text-xs text-pewter">{photo.reason}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      ) : null}
    </main>
  );
}
