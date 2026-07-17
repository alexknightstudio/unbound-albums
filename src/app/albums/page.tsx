import Link from "next/link";
import { redirect } from "next/navigation";

import { type AlbumStatus, statusCopy } from "@/lib/albums/status";
import { ALBUM_SIZE_SPECS, type AlbumSize } from "@/lib/albums/sizes";
import { createClient } from "@/lib/supabase/server";

import { signOut } from "./actions";
import { NewAlbumForm } from "./new-album-form";

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
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-14 px-6 py-16">
      <header className="flex flex-col gap-3">
        <h1 className="font-display text-5xl text-parchment">
          {existing.length > 0 ? "Your albums." : "Start your album."}
        </h1>
        <p className="text-sm text-pewter">
          {existing.length > 0
            ? "Around 150 photos. A designer does the rest."
            : "Who, when, where — then your photos. A designer does the rest."}
        </p>
      </header>

      {existing.length > 0 && (
        <ul className="flex flex-col gap-px overflow-hidden rounded-md border border-stone">
          {existing.map((album) => (
            <li key={album.id}>
              <Link
                href={`/albums/${album.id}`}
                className="flex items-center justify-between gap-4 bg-charcoal px-5 py-4 transition-colors hover:bg-stone"
              >
                <span className="flex flex-col gap-1">
                  <span className="text-base text-parchment">{album.title}</span>
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
      )}

      <NewAlbumForm />

      <footer className="flex items-center justify-between border-t border-stone pt-6">
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
  );
}
