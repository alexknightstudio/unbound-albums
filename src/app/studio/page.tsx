import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { type AlbumBrief, briefSummary } from "@/lib/albums/brief";
import { ALBUM_SIZE_SPECS, DEFAULT_ALBUM_SIZE, isAlbumSize } from "@/lib/albums/sizes";
import { type AlbumStatus } from "@/lib/albums/status";
import { createClient } from "@/lib/supabase/server";

/**
 * The designers' queue. Staff-only: a non-staff visitor gets a 404, not a
 * login wall — the studio's existence is nobody else's business.
 */

type QueueRow = {
  id: string;
  title: string;
  status: AlbumStatus;
  size: string;
  created_at: string;
  brief: AlbumBrief | null;
};

const QUEUE_LABEL: Partial<Record<AlbumStatus, string>> = {
  in_design: "Waiting on a proof",
  in_revision: "Notes came back",
  proof_ready: "With the couple",
  approved: "Approved",
};

export default async function StudioPage() {
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

  const { data: albums } = await supabase
    .from("albums")
    .select("id, title, status, size, created_at, brief")
    .in("status", ["in_design", "in_revision", "proof_ready", "approved"])
    .order("created_at", { ascending: true })
    .returns<QueueRow[]>();

  const queue = albums ?? [];
  const actionable = queue.filter(
    (a) => a.status === "in_design" || a.status === "in_revision",
  );
  const waiting = queue.filter(
    (a) => a.status === "proof_ready" || a.status === "approved",
  );

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-12 px-6 py-16">
      <header className="flex flex-col gap-3">
        <p className="text-xs uppercase tracking-[0.3em] text-slate">
          The studio
        </p>
        <h1 className="font-display text-5xl text-parchment">
          {actionable.length === 0
            ? "The queue is clear."
            : `${actionable.length} ${actionable.length === 1 ? "album needs" : "albums need"} you.`}
        </h1>
      </header>

      {[
        { title: "On your desk", rows: actionable },
        { title: "Out of your hands", rows: waiting },
      ].map((group) =>
        group.rows.length > 0 ? (
          <section key={group.title} className="flex flex-col gap-4">
            <h2 className="text-xs uppercase tracking-[0.3em] text-slate">
              {group.title}
            </h2>
            <ul className="flex flex-col gap-px overflow-hidden rounded-md border border-stone">
              {group.rows.map((album) => {
                const size = isAlbumSize(album.size) ? album.size : DEFAULT_ALBUM_SIZE;
                return (
                  <li key={album.id}>
                    <Link
                      href={`/studio/${album.id}`}
                      className="flex flex-col gap-1 bg-charcoal px-5 py-4 transition-colors hover:bg-stone"
                    >
                      <span className="flex items-baseline justify-between gap-4">
                        <span className="text-base text-parchment">
                          {album.title}
                        </span>
                        <span className="shrink-0 text-xs text-slate">
                          {QUEUE_LABEL[album.status]}
                        </span>
                      </span>
                      <span className="text-xs text-slate">
                        {ALBUM_SIZE_SPECS[size].label}
                        {album.brief ? ` · ${briefSummary(album.brief)}` : ""}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null,
      )}
    </main>
  );
}
