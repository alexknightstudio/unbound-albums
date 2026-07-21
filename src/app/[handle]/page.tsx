/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { notFound } from "next/navigation";

import { createAdminClient } from "@/lib/supabase/admin";

import type { Metadata } from "next";

/**
 * The public profile — /@handle (PLATFORM_SPEC §4): an owner's public
 * galleries as a portfolio page. Only matches segments starting with "@";
 * anything else 404s (static routes always win before this catch).
 */

type ProfileAccount = {
  user_id: string;
  handle: string;
  display_name: string | null;
};

type PublicGallery = {
  id: string;
  title: string;
  slug: string;
  event_date: string | null;
  cover_photo_id: string | null;
};

async function loadProfile(rawHandle: string) {
  const decoded = decodeURIComponent(rawHandle);
  if (!decoded.startsWith("@")) return null;
  const handle = decoded.slice(1).toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]{2,29}$/.test(handle)) return null;

  const admin = createAdminClient();
  const { data: account } = await admin
    .from("accounts")
    .select("user_id, handle, display_name")
    .eq("handle", handle)
    .maybeSingle<ProfileAccount>();
  if (!account) return null;

  const { data: galleries } = await admin
    .from("galleries")
    .select("id, title, slug, event_date, cover_photo_id")
    .eq("owner_id", account.user_id)
    .eq("visibility", "public")
    .order("created_at", { ascending: false })
    .returns<PublicGallery[]>();

  const rows = galleries ?? [];
  // Cover fallback: first photo of each gallery.
  const covers = new Map<string, string>();
  for (const g of rows) {
    if (g.cover_photo_id) {
      covers.set(g.id, g.cover_photo_id);
      continue;
    }
    const { data: first } = await admin
      .from("gallery_photos")
      .select("id")
      .eq("gallery_id", g.id)
      .order("position")
      .limit(1)
      .maybeSingle<{ id: string }>();
    if (first) covers.set(g.id, first.id);
  }

  return { account, galleries: rows, covers };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ handle: string }>;
}): Promise<Metadata> {
  const { handle } = await params;
  const profile = await loadProfile(handle);
  if (!profile) return { title: "Not found" };
  const name = profile.account.display_name ?? `@${profile.account.handle}`;
  return {
    title: `${name} (@${profile.account.handle})`,
    description: `${name}'s galleries on Unbound.`,
    robots: { index: true, follow: true },
  };
}

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;
  const profile = await loadProfile(handle);
  if (!profile) notFound();

  const { account, galleries, covers } = profile;
  const name = account.display_name ?? `@${account.handle}`;

  return (
    <main className="flex-1 bg-neutral-0">
      <header className="border-b border-line">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link href="/" aria-label="Unbound — home" className="flex items-center">
            <img src="/unbound-wordmark-ink.png" alt="Unbound" className="block h-3 w-auto" />
          </Link>
          <Link
            href="/login"
            className="text-sm font-medium text-muted transition-colors hover:text-heading"
          >
            Host your photos
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-6 pb-24 pt-14">
        <div className="text-center">
          <h1 className="text-3xl font-semibold tracking-tight text-heading">
            {name}
          </h1>
          <p className="mt-1 text-sm text-muted">@{account.handle}</p>
        </div>

        {galleries.length === 0 ? (
          <p className="mt-16 text-center text-sm text-muted">
            Nothing public here yet.
          </p>
        ) : (
          <ul className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {galleries.map((gallery) => {
              const cover = covers.get(gallery.id);
              return (
                <li key={gallery.id}>
                  <Link
                    href={`/g/${gallery.slug}`}
                    className="group block overflow-hidden rounded-xl border border-line bg-neutral-0 shadow-xs transition-shadow hover:shadow-md"
                  >
                    {cover ? (
                      <img
                        src={`/i/${cover}`}
                        alt=""
                        loading="lazy"
                        className="aspect-[4/3] w-full object-cover transition-opacity group-hover:opacity-95"
                      />
                    ) : (
                      <div className="aspect-[4/3] w-full bg-well" />
                    )}
                    <div className="p-4">
                      <p className="font-semibold text-heading">{gallery.title}</p>
                      {gallery.event_date ? (
                        <p className="mt-0.5 text-sm text-muted">{gallery.event_date}</p>
                      ) : null}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </main>
  );
}
