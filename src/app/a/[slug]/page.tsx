import { notFound } from "next/navigation";

import { AlbumViewer } from "@/components/album/album-viewer";
import { loadAlbumPresentation } from "@/lib/albums/presentation";
import { DEFAULT_ALBUM_SIZE, isAlbumSize } from "@/lib/albums/sizes";
import { createAdminClient } from "@/lib/supabase/admin";

import type { Metadata } from "next";

/**
 * The link preview IS the invitation: when this URL lands in iMessage or
 * WhatsApp, the couple's names and cover photo should appear. And because
 * the slug is a private capability, search engines are told to stay out.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const admin = createAdminClient();
  const { data: album } = await admin
    .from("albums")
    .select("title, status")
    .eq("share_slug", slug)
    .maybeSingle<{ title: string; status: string }>();

  const shareable =
    album &&
    (album.status === "ready" ||
      album.status === "ordered" ||
      album.status === "shipped");
  if (!shareable) {
    return { robots: { index: false, follow: false } };
  }

  const description = "An album to keep. Made with Unbound.";
  return {
    title: album.title,
    description,
    robots: { index: false, follow: false },
    openGraph: {
      title: `${album.title} — an album to keep`,
      description,
      images: [{ url: `/a/${slug}/cover-image` }],
    },
    twitter: {
      card: "summary_large_image",
      title: `${album.title} — an album to keep`,
      description,
      images: [`/a/${slug}/cover-image`],
    },
  };
}

type SharedAlbum = {
  id: string;
  title: string;
  status: string;
  size: string;
};

/**
 * The shareable album — the free web preview that ships with every order.
 *
 * No login: the unguessable slug (122 bits, CSPRNG) IS the capability. Read
 * only; no editing controls, no set-aside tray (the couple's curation
 * conversation is theirs alone). Grandparents open this on their phones —
 * it must be nothing but the album.
 */
export default async function SharedAlbumPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  // Slug lookup needs no auth by design; the admin client reads on behalf
  // of whoever holds the link.
  const admin = createAdminClient();
  const { data: album } = await admin
    .from("albums")
    .select("id, title, status, size")
    .eq("share_slug", slug)
    .maybeSingle<SharedAlbum>();

  // Not found and not-ready look identical from outside — an unfinished
  // album simply doesn't exist yet for link-holders.
  if (
    !album ||
    (album.status !== "ready" &&
      album.status !== "ordered" &&
      album.status !== "shipped")
  ) {
    notFound();
  }

  const size = isAlbumSize(album.size) ? album.size : DEFAULT_ALBUM_SIZE;
  const presentation = await loadAlbumPresentation(album.id, size);
  if (!presentation) notFound();

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-10 px-6 py-16">
      <header className="flex flex-col gap-2 text-center">
        <h1 className="font-display text-5xl font-light text-parchment">
          {album.title}
        </h1>
        <p className="text-sm text-pewter">An album to keep.</p>
      </header>

      <AlbumViewer
        spreads={presentation.spreads}
        photoUrls={presentation.photoUrls}
        sizeSpec={presentation.sizeSpec}
      />

      <footer className="pt-8 text-center">
        <p className="text-xs tracking-widest text-slate">
          UNBOUND · Your love story, <span className="italic">unbound.</span>
        </p>
      </footer>
    </main>
  );
}
