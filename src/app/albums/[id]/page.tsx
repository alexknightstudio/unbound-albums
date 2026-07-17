/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { AlbumViewer } from "@/components/album/album-viewer";
import { type AlbumBrief, briefSummary } from "@/lib/albums/brief";
import { loadAlbumPresentation } from "@/lib/albums/presentation";
import {
  ALBUM_SIZE_SPECS,
  DEFAULT_ALBUM_SIZE,
  DOWNLOAD_PRICE_CENTS,
  formatPrice,
  isAlbumSize,
} from "@/lib/albums/sizes";
import { type AlbumStatus, hasProof, statusCopy } from "@/lib/albums/status";
import { createClient } from "@/lib/supabase/server";

import { BriefForm } from "./brief-form";
import { FinishUploadingButton } from "./finish-uploading-button";
import { PhotoUploader } from "./photo-uploader";
import { ProofViewer, type ProofPageView } from "./proof-viewer";

type AlbumRow = {
  id: string;
  title: string;
  status: AlbumStatus;
  size: string;
  share_slug: string;
  brief: AlbumBrief | null;
};

type ProofRow = {
  id: string;
  round: number;
  note: string | null;
};

async function loadLatestProof(albumId: string) {
  const supabase = await createClient();
  const { data: proof } = await supabase
    .from("proofs")
    .select("id, round, note")
    .eq("album_id", albumId)
    .order("round", { ascending: false })
    .limit(1)
    .maybeSingle<ProofRow>();
  if (!proof) return null;

  const { data: pageRows } = await supabase
    .from("proof_pages")
    .select("position, storage_path")
    .eq("proof_id", proof.id)
    .order("position", { ascending: true })
    .returns<Array<{ position: number; storage_path: string }>>();
  if (!pageRows || pageRows.length === 0) return null;

  const { data: signed } = await supabase.storage
    .from("proofs")
    .createSignedUrls(
      pageRows.map((p) => p.storage_path),
      60 * 60,
    );

  const pages: ProofPageView[] = pageRows.flatMap((p, i) => {
    const url = signed?.[i]?.signedUrl;
    return url ? [{ position: p.position, url }] : [];
  });
  if (pages.length === 0) return null;

  const { data: notes } = await supabase
    .from("revision_notes")
    .select("position, note, created_at")
    .eq("proof_id", proof.id)
    .order("created_at", { ascending: true })
    .returns<Array<{ position: number | null; note: string; created_at: string }>>();

  return { proof, pages, notes: notes ?? [] };
}

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
    .select("id, title, status, size, share_slug, brief")
    .eq("id", id)
    .maybeSingle<AlbumRow>();

  // RLS makes another couple's album indistinguishable from one that doesn't
  // exist — which is the right answer to give either way.
  if (!album) notFound();

  const size = isAlbumSize(album.size) ? album.size : DEFAULT_ALBUM_SIZE;

  const { count } = await supabase
    .from("photos")
    .select("id", { count: "exact", head: true })
    .eq("album_id", album.id);

  // Legacy AI-era albums keep their template-rendered viewer.
  const legacy =
    album.status === "ready" ||
    album.status === "ordered" ||
    album.status === "shipped";
  const presentation = legacy ? await loadAlbumPresentation(album.id, size) : null;

  const proofData = hasProof(album.status) && !legacy ? await loadLatestProof(album.id) : null;

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
        <>
          <PhotoUploader albumId={album.id} existingCount={count ?? 0} />
          <FinishUploadingButton albumId={album.id} photoCount={count ?? 0} />
        </>
      ) : null}

      {album.status === "briefing" ? <BriefForm albumId={album.id} /> : null}

      {album.status === "in_design" ? (
        <section className="flex flex-col gap-4 rounded-md border border-stone p-6">
          <h2 className="font-display text-3xl text-parchment">
            Your designer is on it.
          </h2>
          <p className="max-w-md text-sm leading-relaxed text-pewter">
            {count ?? 0} photos and your brief are with a designer now. Your
            proof will appear right here — every page, ready to review.
          </p>
          {album.brief ? (
            <p className="text-xs text-slate">{briefSummary(album.brief)}</p>
          ) : null}
        </section>
      ) : null}

      {album.status === "in_revision" && proofData ? (
        <section className="flex flex-col gap-8">
          <div className="flex flex-col gap-4 rounded-md border border-stone p-6">
            <h2 className="font-display text-3xl text-parchment">
              Your notes are in good hands.
            </h2>
            <p className="max-w-md text-sm leading-relaxed text-pewter">
              Your designer is reworking the pages. The next round will appear
              here.
            </p>
            {proofData.notes.length > 0 ? (
              <ul className="flex flex-col gap-2 border-t border-stone pt-4">
                {proofData.notes.map((note, i) => (
                  <li key={i} className="text-xs leading-relaxed text-slate">
                    <span className="text-pewter">
                      {note.position
                        ? `Pages ${note.position * 2 - 1}–${note.position * 2}: `
                        : "The album: "}
                    </span>
                    {note.note}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
          <ProofViewer
            albumId={album.id}
            proofId={proofData.proof.id}
            round={proofData.proof.round}
            designerNote={proofData.proof.note}
            pages={proofData.pages}
            mode="readonly"
          />
        </section>
      ) : null}

      {album.status === "proof_ready" && proofData ? (
        <ProofViewer
          albumId={album.id}
          proofId={proofData.proof.id}
          round={proofData.proof.round}
          designerNote={proofData.proof.note}
          pages={proofData.pages}
          mode="review"
        />
      ) : null}

      {album.status === "approved" && proofData ? (
        <section className="flex flex-col gap-10">
          <div className="flex flex-col gap-5 rounded-md border border-pewter p-6">
            <h2 className="font-display text-3xl text-parchment">
              Approved. Make it real.
            </h2>
            <div className="flex flex-col gap-3">
              <div className="flex items-baseline justify-between gap-4">
                <span className="text-sm text-parchment">
                  The printed album — {ALBUM_SIZE_SPECS[size].label}, hardcover,
                  lay-flat
                </span>
                <span className="text-sm text-pewter">
                  {formatPrice(ALBUM_SIZE_SPECS[size].priceCents)}
                </span>
              </div>
              <div className="flex items-baseline justify-between gap-4">
                <span className="text-sm text-parchment">
                  The print-ready files — print anywhere
                </span>
                <span className="text-sm text-pewter">
                  {formatPrice(DOWNLOAD_PRICE_CENTS)}
                </span>
              </div>
            </div>
            <p className="text-xs text-slate">
              Ordering opens soon. We&rsquo;ll email you the moment it does.
            </p>
          </div>
          <ProofViewer
            albumId={album.id}
            proofId={proofData.proof.id}
            round={proofData.proof.round}
            designerNote={proofData.proof.note}
            pages={proofData.pages}
            mode="readonly"
          />
        </section>
      ) : null}

      {hasProof(album.status) && !legacy && !proofData ? (
        <p className="text-sm text-pewter">
          Your proof is on its way to this page. Check back in a moment.
        </p>
      ) : null}

      {presentation ? (
        <section className="flex flex-col gap-8">
          <AlbumViewer
            spreads={presentation.spreads}
            photoUrls={presentation.photoUrls}
            sizeSpec={presentation.sizeSpec}
          />

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
