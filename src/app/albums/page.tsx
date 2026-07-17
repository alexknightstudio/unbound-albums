/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { redirect } from "next/navigation";

import { type AlbumStatus, statusCopy } from "@/lib/albums/status";
import { ALBUM_SIZE_SPECS, type AlbumSize } from "@/lib/albums/sizes";
import { createClient } from "@/lib/supabase/server";

import { signOut } from "./actions";
import { StartAlbumSection } from "./start-album-section";

type AlbumRow = {
  id: string;
  title: string;
  status: AlbumStatus;
  size: AlbumSize;
  created_at: string;
};

export default async function AlbumsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // proxy.ts already gates this route. Re-checking here means a proxy
  // misconfiguration can't quietly turn into a data leak.
  if (!user) redirect("/login");

  // RLS scopes this to the signed-in couple — no user_id filter needed, and
  // adding one would imply the database can't be trusted to do it.
  const { data: albums } = await supabase
    .from("albums")
    .select("id, title, status, size, created_at")
    .order("created_at", { ascending: false })
    .returns<AlbumRow[]>();

  const existing = albums ?? [];

  return (
    <div className="flex flex-1 flex-col">
      <header className="px-6 py-8 sm:px-12">
        <Link href="/" aria-label="Unbound — home" className="inline-block">
          <img
            src="/unbound-wordmark-white.png"
            alt="UNBOUND"
            className="block h-[15px] w-auto"
          />
        </Link>
      </header>

      <main className="mx-auto flex w-full max-w-[1160px] flex-1 flex-col gap-16 px-6 pb-24 pt-8 sm:px-12">
        {existing.length > 0 ? (
          <section className="flex max-w-lg flex-col gap-6">
            <h1 className="font-display text-4xl text-parchment">
              Your albums.
            </h1>
            <ul className="flex flex-col gap-px overflow-hidden rounded-md border border-stone">
              {existing.map((album) => (
                <li key={album.id}>
                  <Link
                    href={`/albums/${album.id}`}
                    className="flex items-center justify-between gap-4 bg-charcoal px-5 py-4 transition-colors hover:bg-stone"
                  >
                    <span className="flex flex-col gap-1">
                      <span className="text-base text-parchment">
                        {album.title}
                      </span>
                      <span className="text-xs text-slate">
                        {ALBUM_SIZE_SPECS[album.size].label} ·{" "}
                        {statusCopy(album.status)}
                      </span>
                    </span>
                    <span aria-hidden className="text-pewter">
                      →
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {existing.length > 0 ? (
          <div className="border-t border-stone pt-16">
            <StartAlbumSection heading="Start another." />
          </div>
        ) : (
          <StartAlbumSection heading="Start your album." />
        )}

        <footer className="mt-auto flex items-center justify-between border-t border-stone pt-6">
          <span className="text-xs text-slate">{user.email}</span>
          <form action={signOut}>
            <button
              type="submit"
              className="text-xs text-slate transition-colors hover:text-pewter"
            >
              Sign out
            </button>
          </form>
        </footer>
      </main>
    </div>
  );
}
