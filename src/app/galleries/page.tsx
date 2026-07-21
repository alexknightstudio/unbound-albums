import Link from "next/link";
import { redirect } from "next/navigation";

import { AppNav } from "@/components/app/app-nav";
import { createClient } from "@/lib/supabase/server";

import { NewGalleryForm } from "./gallery-forms";

/** The dashboard — tokens v1, universal accounts (PLATFORM_SPEC P0). */

type GalleryRow = {
  id: string;
  title: string;
  slug: string;
  event_date: string | null;
  created_at: string;
};

export default async function GalleriesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Provisioned by the signup trigger; the upsert covers anyone who predates it.
  let { data: account } = await supabase
    .from("accounts")
    .select("display_name")
    .eq("user_id", user.id)
    .maybeSingle<{ display_name: string | null }>();
  if (!account) {
    const display_name = (user.email ?? "someone").split("@")[0];
    await supabase.from("accounts").upsert({ user_id: user.id, display_name });
    account = { display_name };
  }

  const { data: galleries } = await supabase
    .from("galleries")
    .select("id, title, slug, event_date, created_at")
    .order("created_at", { ascending: false })
    .returns<GalleryRow[]>();
  const rows = galleries ?? [];

  return (
    <div className="flex flex-1 flex-col bg-canvas">
      <AppNav email={user.email ?? ""} />

      <main className="mx-auto w-full max-w-6xl flex-1 px-6 pb-24 pt-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-heading">
              Galleries
            </h1>
            <p className="mt-1 text-sm text-muted">
              {account.display_name ?? "Your space"}
              {rows.length > 0
                ? ` · ${rows.length} ${rows.length === 1 ? "gallery" : "galleries"}`
                : " · your first gallery starts below"}
            </p>
          </div>
        </div>

        {rows.length > 0 ? (
          <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {rows.map((gallery) => (
              <li key={gallery.id}>
                <Link
                  href={`/galleries/${gallery.id}`}
                  className="block rounded-xl border border-line bg-neutral-0 p-5 shadow-xs transition-shadow hover:shadow-md"
                >
                  <p className="font-semibold text-heading">{gallery.title}</p>
                  <p className="mt-1 text-sm text-muted">
                    {gallery.event_date ?? "No date"}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        ) : null}

        <section className="mt-12 max-w-md rounded-xl border border-line bg-neutral-0 p-6 shadow-xs">
          <h2 className="text-lg font-semibold text-heading">New gallery</h2>
          <div className="mt-4">
            <NewGalleryForm />
          </div>
        </section>
      </main>
    </div>
  );
}
