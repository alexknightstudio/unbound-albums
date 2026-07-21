/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { r2Configured, signedGetUrl } from "@/lib/galleries/r2";
import { createClient } from "@/lib/supabase/server";

import { GalleryUploader } from "./gallery-uploader";
import { VisibilityControl } from "./visibility-control";

type GalleryRow = {
  id: string;
  title: string;
  slug: string;
  event_date: string | null;
  password_hash: string | null;
  visibility: string;
};

type PhotoRow = {
  id: string;
  thumb_key: string | null;
  filename: string;
  position: number;
};

export default async function GalleryManagePage({
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

  // RLS: only the owning photographer sees this row.
  const { data: gallery } = await supabase
    .from("galleries")
    .select("id, title, slug, event_date, password_hash, visibility")
    .eq("id", id)
    .maybeSingle<GalleryRow>();
  if (!gallery) notFound();

  const { data: account } = await supabase
    .from("accounts")
    .select("handle")
    .eq("user_id", user.id)
    .maybeSingle<{ handle: string | null }>();

  const { data: photos } = await supabase
    .from("gallery_photos")
    .select("id, thumb_key, filename, position")
    .eq("gallery_id", id)
    .order("position", { ascending: true })
    .returns<PhotoRow[]>();
  const rows = photos ?? [];

  const storageReady = r2Configured();
  const thumbUrls = new Map<string, string>();
  if (storageReady) {
    await Promise.all(
      rows
        .filter((p) => p.thumb_key)
        .map(async (p) => {
          thumbUrls.set(p.id, await signedGetUrl(p.thumb_key!));
        }),
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 bg-canvas px-6 py-10">
      <Link
        href="/galleries"
        className="text-sm font-medium text-muted transition-colors hover:text-heading"
      >
        ← All galleries
      </Link>

      <header className="flex flex-col gap-3">
        <h1 className="text-3xl font-semibold tracking-tight text-heading">{gallery.title}</h1>
        <p className="text-sm text-muted">
          {rows.length} {rows.length === 1 ? "photo" : "photos"} ·{" "}
          {gallery.visibility}
          {gallery.visibility === "private" && gallery.password_hash
            ? " · password"
            : ""}
        </p>
        <p className="text-sm text-muted">
          Client link:{" "}
          <Link
            href={`/g/${gallery.slug}`}
            className="font-medium text-accent underline-offset-4 hover:underline"
          >
            {`/g/${gallery.slug}`}
          </Link>
        </p>
      </header>

      <VisibilityControl
        galleryId={gallery.id}
        visibility={gallery.visibility}
        handle={account?.handle ?? null}
      />

      {storageReady ? (
        <GalleryUploader
          galleryId={gallery.id}
          existingFilenames={rows.map((p) => p.filename)}
        />
      ) : (
        <div className="rounded-xl border border-line bg-neutral-0 p-6 shadow-xs">
          <p className="text-sm font-medium text-heading">Storage isn&rsquo;t connected yet.</p>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Add the four R2 values to .env.local (see the Cloudflare checklist
            in DECISIONS.md), restart the dev server, and this page becomes the
            uploader.
          </p>
        </div>
      )}

      {rows.length > 0 ? (
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          {rows.map((photo) => (
            <li
              key={photo.id}
              className="overflow-hidden rounded-lg border border-line bg-neutral-0 shadow-xs"
            >
              {thumbUrls.has(photo.id) ? (
                <img
                  src={thumbUrls.get(photo.id)}
                  alt={photo.filename}
                  loading="lazy"
                  className="aspect-square w-full object-cover"
                />
              ) : (
                <span className="flex aspect-square w-full items-center justify-center bg-well p-1 text-center text-[13px] text-faint">
                  {photo.position}
                </span>
              )}
            </li>
          ))}
        </ul>
      ) : null}
    </main>
  );
}
