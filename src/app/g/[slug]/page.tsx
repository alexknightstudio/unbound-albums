/* eslint-disable @next/next/no-img-element */
import { cookies } from "next/headers";
import { notFound } from "next/navigation";

import {
  GALLERY_ACCESS_COOKIE,
  verifyAccessToken,
} from "@/lib/galleries/access";
import { r2Configured, signedGetUrl } from "@/lib/galleries/r2";
import { createAdminClient } from "@/lib/supabase/admin";

import { GalleryUnlock } from "./gallery-unlock";

import type { Metadata } from "next";

/**
 * The gallery viewer — branches on visibility (PLATFORM_SPEC §4):
 *   private  — password/cookie gate, per-request signed URLs, noindex
 *   unlisted — link is the capability, /i/ image URLs, noindex
 *   public   — indexed, OpenGraph, /i/ image URLs, on the owner's profile
 * The photo surface stays near-black and chrome-free at every visibility.
 */

type GalleryRow = {
  id: string;
  title: string;
  event_date: string | null;
  password_hash: string | null;
  expires_at: string | null;
  visibility: "private" | "unlisted" | "public";
  cover_photo_id: string | null;
  owner_id: string;
};

function expired(gallery: GalleryRow): boolean {
  return !!gallery.expires_at && new Date(gallery.expires_at) < new Date();
}

async function loadGallery(slug: string): Promise<GalleryRow | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("galleries")
    .select(
      "id, title, event_date, password_hash, expires_at, visibility, cover_photo_id, owner_id",
    )
    .eq("slug", slug)
    .maybeSingle<GalleryRow>();
  return data ?? null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const gallery = await loadGallery(slug);
  if (!gallery || expired(gallery)) return { title: "Gallery" };

  if (gallery.visibility !== "public") {
    return { title: gallery.title, robots: { index: false, follow: false } };
  }

  const admin = createAdminClient();
  const { data: account } = await admin
    .from("accounts")
    .select("display_name, handle")
    .eq("user_id", gallery.owner_id)
    .maybeSingle<{ display_name: string | null; handle: string | null }>();

  const ogImage = gallery.cover_photo_id
    ? `/i/${gallery.cover_photo_id}`
    : undefined;
  return {
    title: gallery.title,
    description: account?.display_name
      ? `A gallery by ${account.display_name} on Unbound.`
      : "A gallery on Unbound.",
    robots: { index: true, follow: true },
    openGraph: {
      title: gallery.title,
      type: "website",
      ...(ogImage ? { images: [ogImage] } : {}),
    },
  };
}

export default async function GalleryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const gallery = await loadGallery(slug);
  if (!gallery || expired(gallery)) notFound();

  const admin = createAdminClient();
  const { data: account } = await admin
    .from("accounts")
    .select("display_name, handle")
    .eq("user_id", gallery.owner_id)
    .maybeSingle<{ display_name: string | null; handle: string | null }>();

  // Only private galleries gate on a password.
  let unlocked = gallery.visibility !== "private" || !gallery.password_hash;
  if (!unlocked) {
    const jar = await cookies();
    const token = jar.get(GALLERY_ACCESS_COOKIE(gallery.id))?.value;
    unlocked = !!token && verifyAccessToken(token, gallery.id);
  }

  const shell = (children: React.ReactNode) => (
    <main className="flex min-h-svh w-full flex-1 flex-col bg-viewer px-6 py-14 text-parchment sm:px-10">
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col">
        <header className="flex flex-col items-center gap-2 pb-12 text-center">
          {account?.display_name ? (
            gallery.visibility === "public" && account.handle ? (
              <a
                href={`/@${account.handle}`}
                className="text-xs uppercase tracking-[0.3em] text-slate transition-colors hover:text-pewter"
              >
                {account.display_name}
              </a>
            ) : (
              <p className="text-xs uppercase tracking-[0.3em] text-slate">
                {account.display_name}
              </p>
            )
          ) : null}
          <h1 className="text-3xl font-semibold tracking-tight text-parchment sm:text-4xl">
            {gallery.title}
          </h1>
          {gallery.event_date ? (
            <p className="text-sm text-pewter">{gallery.event_date}</p>
          ) : null}
        </header>
        {children}
      </div>
    </main>
  );

  if (!unlocked) {
    return shell(
      <div className="flex flex-1 flex-col items-center">
        <GalleryUnlock slug={slug} />
      </div>,
    );
  }

  if (!r2Configured()) {
    return shell(
      <p className="text-center text-sm text-pewter">
        This gallery is being prepared. Check back soon.
      </p>,
    );
  }

  const { data: photos } = await admin
    .from("gallery_photos")
    .select("id, r2_key, thumb_key, position")
    .eq("gallery_id", gallery.id)
    .order("position", { ascending: true })
    .returns<
      Array<{ id: string; r2_key: string; thumb_key: string | null; position: number }>
    >();
  const rows = photos ?? [];

  // Private: per-request signed URLs (expiring, behind the gate).
  // Unlisted/public: stable /i/ URLs — cacheable, shareable, re-checked
  // against visibility on every image request.
  const urls =
    gallery.visibility === "private"
      ? await Promise.all(
          rows.map(async (p) => ({
            id: p.id,
            thumb: p.thumb_key ? await signedGetUrl(p.thumb_key) : null,
            full: await signedGetUrl(p.r2_key),
          })),
        )
      : rows.map((p) => ({
          id: p.id,
          thumb: `/i/${p.id}`,
          full: `/i/${p.id}?full=1`,
        }));

  return shell(
    rows.length === 0 ? (
      <p className="text-center text-sm text-pewter">
        Photos are on their way. Check back soon.
      </p>
    ) : (
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {urls.map((photo, i) => (
          <li key={photo.id} className="overflow-hidden rounded-sm">
            <a
              href={photo.full}
              target="_blank"
              rel="noreferrer"
              className="block transition-opacity hover:opacity-90"
            >
              {photo.thumb ? (
                <img
                  src={photo.thumb}
                  alt=""
                  loading={i < 8 ? "eager" : "lazy"}
                  className="aspect-square w-full object-cover"
                />
              ) : (
                <span className="block aspect-square w-full bg-charcoal" />
              )}
            </a>
          </li>
        ))}
      </ul>
    ),
  );
}
