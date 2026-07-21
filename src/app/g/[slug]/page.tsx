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
 * The client-facing gallery — the product (HOSTING_SPEC.md §5).
 * Slug is the capability; password (if set) gates it; every image URL is
 * short-TTL signed. Admin client by design: visitors have no session.
 * Never indexed — client photos are private by default.
 */

type GalleryRow = {
  id: string;
  title: string;
  event_date: string | null;
  password_hash: string | null;
  expires_at: string | null;
  photographer_id: string;
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const admin = createAdminClient();
  const { data } = await admin
    .from("galleries")
    .select("title")
    .eq("slug", slug)
    .maybeSingle<{ title: string }>();
  return {
    title: data?.title ?? "Gallery",
    robots: { index: false, follow: false },
  };
}

export default async function PublicGalleryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const admin = createAdminClient();

  const { data: gallery } = await admin
    .from("galleries")
    .select("id, title, event_date, password_hash, expires_at, photographer_id")
    .eq("slug", slug)
    .maybeSingle<GalleryRow>();
  if (!gallery) notFound();
  if (gallery.expires_at && new Date(gallery.expires_at) < new Date()) notFound();

  const { data: account } = await admin
    .from("photographer_accounts")
    .select("business_name")
    .eq("user_id", gallery.photographer_id)
    .maybeSingle<{ business_name: string }>();

  let unlocked = !gallery.password_hash;
  if (!unlocked) {
    const jar = await cookies();
    const token = jar.get(GALLERY_ACCESS_COOKIE(gallery.id))?.value;
    unlocked = !!token && verifyAccessToken(token, gallery.id);
  }

  const shell = (children: React.ReactNode) => (
    <main className="flex min-h-svh w-full flex-1 flex-col bg-viewer px-6 py-14 text-parchment sm:px-10">
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col">
      <header className="flex flex-col items-center gap-2 pb-12 text-center">
        {account ? (
          <p className="text-xs uppercase tracking-[0.3em] text-slate">
            {account.business_name}
          </p>
        ) : null}
        <h1 className="font-display text-4xl text-parchment sm:text-5xl">
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
    .select("id, r2_key, thumb_key, filename, position")
    .eq("gallery_id", gallery.id)
    .order("position", { ascending: true })
    .returns<
      Array<{
        id: string;
        r2_key: string;
        thumb_key: string | null;
        filename: string;
        position: number;
      }>
    >();
  const rows = photos ?? [];

  const urls = await Promise.all(
    rows.map(async (p) => ({
      id: p.id,
      filename: p.filename,
      thumb: p.thumb_key ? await signedGetUrl(p.thumb_key) : null,
      full: await signedGetUrl(p.r2_key),
    })),
  );

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
                  // First screenful loads immediately; the long tail stays lazy.
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
