import Link from "next/link";
import { redirect } from "next/navigation";

import { AppNav } from "@/components/app/app-nav";
import { createClient } from "@/lib/supabase/server";

import { ActivateForm, NewGalleryForm } from "./gallery-forms";

/**
 * The dashboard — tokens v1. Still reads photographer_accounts until the P0
 * accounts migration is applied (blocked on DB access; see DECISIONS.md),
 * then this swaps to `accounts` and the activation gate disappears.
 */

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

  const { data: account } = await supabase
    .from("photographer_accounts")
    .select("business_name")
    .eq("user_id", user.id)
    .maybeSingle<{ business_name: string }>();

  const { data: galleries } = account
    ? await supabase
        .from("galleries")
        .select("id, title, slug, event_date, created_at")
        .order("created_at", { ascending: false })
        .returns<GalleryRow[]>()
    : { data: null };

  return (
    <div className="flex flex-1 flex-col bg-canvas">
      <AppNav email={user.email ?? ""} />

      <main className="mx-auto w-full max-w-6xl flex-1 px-6 pb-24 pt-10">
        {!account ? (
          <section className="mx-auto mt-10 max-w-md rounded-xl border border-line bg-neutral-0 p-8 shadow-sm">
            <h1 className="text-2xl font-semibold tracking-tight text-heading">
              Welcome to Unbound.
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              One quick thing — what should we call you? A studio name, a
              brand, or just your own.
            </p>
            <div className="mt-6">
              <ActivateForm />
            </div>
          </section>
        ) : (
          <>
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h1 className="text-3xl font-semibold tracking-tight text-heading">
                  Galleries
                </h1>
                <p className="mt-1 text-sm text-muted">
                  {account.business_name}
                  {galleries && galleries.length > 0
                    ? ` · ${galleries.length} ${galleries.length === 1 ? "gallery" : "galleries"}`
                    : ""}
                </p>
              </div>
            </div>

            {galleries && galleries.length > 0 ? (
              <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {galleries.map((gallery) => (
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
          </>
        )}
      </main>
    </div>
  );
}
