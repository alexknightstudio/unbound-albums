/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import {
  type AlbumBrief,
  CAMEO_OPTIONS,
  COVER_MATERIALS,
  DESIGN_MOODS,
  FONT_STYLES,
} from "@/lib/albums/brief";
import {
  ALBUM_SIZE_SPECS,
  BASE_SPREAD_COUNT,
  DEFAULT_ALBUM_SIZE,
  isAlbumSize,
} from "@/lib/albums/sizes";
import { type AlbumStatus, statusCopy } from "@/lib/albums/status";
import { createClient } from "@/lib/supabase/server";

import { ProofUpload } from "./proof-upload";

type AlbumRow = {
  id: string;
  title: string;
  status: AlbumStatus;
  size: string;
  brief: AlbumBrief | null;
  created_at: string;
  event_date: string | null;
  venue: string | null;
};

function briefLine(brief: AlbumBrief) {
  const material = COVER_MATERIALS.find((m) => m.value === brief.cover_material);
  const cameo = CAMEO_OPTIONS.find((c) => c.value === brief.cameo);
  const font = FONT_STYLES.find((f) => f.value === brief.font_style);
  const mood = DESIGN_MOODS.find((m) => m.value === brief.mood);
  return [
    { label: "Cover", value: `${material?.label ?? brief.cover_material} — ${brief.cover_color}` },
    { label: "Cameo", value: cameo?.label ?? brief.cameo },
    { label: "Foil font", value: font?.label ?? brief.font_style },
    { label: "Mood", value: mood?.label ?? brief.mood },
    { label: "Cover text", value: brief.title_text },
  ];
}

export default async function StudioAlbumPage({
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

  const { data: staff } = await supabase
    .from("staff")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle<{ role: string }>();
  if (!staff) notFound();

  const { data: album } = await supabase
    .from("albums")
    .select("id, title, status, size, brief, created_at, event_date, venue")
    .eq("id", id)
    .maybeSingle<AlbumRow>();
  if (!album) notFound();

  const size = isAlbumSize(album.size) ? album.size : DEFAULT_ALBUM_SIZE;
  const spec = ALBUM_SIZE_SPECS[size];

  const { data: photos } = await supabase
    .from("photos")
    .select("id, storage_path, thumb_path, upload_order")
    .eq("album_id", album.id)
    .order("upload_order", { ascending: true })
    .returns<
      Array<{
        id: string;
        storage_path: string;
        thumb_path: string | null;
        upload_order: number;
      }>
    >();
  const photoRows = photos ?? [];

  const [thumbUrls, originalUrls] = await Promise.all([
    supabase.storage
      .from("thumbs")
      .createSignedUrls(
        photoRows.flatMap((p) => (p.thumb_path ? [p.thumb_path] : [])),
        60 * 60,
      ),
    supabase.storage
      .from("originals")
      .createSignedUrls(
        photoRows.map((p) => p.storage_path),
        60 * 60,
      ),
  ]);
  const thumbByPath = new Map(
    (thumbUrls.data ?? []).map((s) => [s.path, s.signedUrl]),
  );
  const originalByPath = new Map(
    (originalUrls.data ?? []).map((s) => [s.path, s.signedUrl]),
  );

  const { data: lastProof } = await supabase
    .from("proofs")
    .select("id, round")
    .eq("album_id", album.id)
    .order("round", { ascending: false })
    .limit(1)
    .maybeSingle<{ id: string; round: number }>();

  const { data: notes } = lastProof
    ? await supabase
        .from("revision_notes")
        .select("position, note, created_at")
        .eq("proof_id", lastProof.id)
        .order("created_at", { ascending: true })
        .returns<Array<{ position: number | null; note: string; created_at: string }>>()
    : { data: [] };

  const actionable =
    album.status === "in_design" || album.status === "in_revision";

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-10 px-6 py-16">
      <Link
        href="/studio"
        className="text-xs text-slate transition-colors hover:text-pewter"
      >
        ← The studio
      </Link>

      <header className="flex flex-col gap-3">
        <h1 className="font-display text-5xl text-parchment">{album.title}</h1>
        <p className="text-sm text-pewter">
          {spec.label} · {BASE_SPREAD_COUNT} spreads · {photoRows.length} photos
          · {statusCopy(album.status)}
        </p>
      </header>

      {album.brief ? (
        <section className="flex flex-col gap-3 rounded-md border border-stone p-6">
          <h2 className="text-xs uppercase tracking-[0.3em] text-slate">
            The brief
          </h2>
          <dl className="flex flex-col gap-2">
            {[
              ...(album.event_date
                ? [{ label: "The day", value: album.event_date }]
                : []),
              ...(album.venue ? [{ label: "Venue", value: album.venue }] : []),
            ].map((row) => (
              <div key={row.label} className="flex gap-4">
                <dt className="w-24 shrink-0 text-xs text-slate">{row.label}</dt>
                <dd className="text-sm text-parchment">{row.value}</dd>
              </div>
            ))}
            {briefLine(album.brief).map((row) => (
              <div key={row.label} className="flex gap-4">
                <dt className="w-24 shrink-0 text-xs text-slate">{row.label}</dt>
                <dd className="text-sm text-parchment">{row.value}</dd>
              </div>
            ))}
          </dl>
          {album.brief.notes ? (
            <p className="border-t border-stone pt-3 text-sm leading-relaxed text-pewter">
              &ldquo;{album.brief.notes}&rdquo;
            </p>
          ) : null}
          <p className="text-xs text-slate">
            Deliver to spec: {spec.pageWidthIn * 2}&times;{spec.pageHeightIn}
            &nbsp;in spreads at 250 DPI, no bleed, 0.5&Prime; safe zones, no
            faces on the fold. Open and close on panoramas.
          </p>
        </section>
      ) : null}

      {album.status === "in_revision" && (notes ?? []).length > 0 ? (
        <section className="flex flex-col gap-3 rounded-md border border-pewter p-6">
          <h2 className="text-xs uppercase tracking-[0.3em] text-slate">
            The couple&rsquo;s notes on round {lastProof?.round}
          </h2>
          <ul className="flex flex-col gap-2">
            {(notes ?? []).map((note, i) => (
              <li key={i} className="text-sm leading-relaxed text-parchment">
                <span className="text-xs text-slate">
                  {note.position
                    ? `Pages ${note.position * 2 - 1}–${note.position * 2} — `
                    : "The album — "}
                </span>
                {note.note}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {actionable ? (
        <ProofUpload
          albumId={album.id}
          nextRound={(lastProof?.round ?? 0) + 1}
          expectedPages={BASE_SPREAD_COUNT}
        />
      ) : (
        <p className="text-sm text-pewter">
          {album.status === "proof_ready"
            ? `Round ${lastProof?.round} is with the couple.`
            : statusCopy(album.status)}
        </p>
      )}

      <section className="flex flex-col gap-4">
        <h2 className="text-xs uppercase tracking-[0.3em] text-slate">
          The photos — click for full resolution
        </h2>
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          {photoRows.map((photo) => {
            const thumb = photo.thumb_path
              ? thumbByPath.get(photo.thumb_path)
              : undefined;
            const original = originalByPath.get(photo.storage_path);
            return (
              <li key={photo.id}>
                <a
                  href={original ?? "#"}
                  target="_blank"
                  rel="noreferrer"
                  className="block overflow-hidden rounded-sm border border-stone transition-colors hover:border-pewter"
                >
                  {thumb ? (
                    <img
                      src={thumb}
                      alt={`Photo ${photo.upload_order + 1}`}
                      loading="lazy"
                      className="aspect-square w-full object-cover"
                    />
                  ) : (
                    <span className="flex aspect-square w-full items-center justify-center bg-charcoal text-xs text-slate">
                      {photo.upload_order + 1}
                    </span>
                  )}
                </a>
              </li>
            );
          })}
        </ul>
      </section>
    </main>
  );
}
