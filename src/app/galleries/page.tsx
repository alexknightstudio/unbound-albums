/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

import { ActivateForm, NewGalleryForm } from "./gallery-forms";

/**
 * The photographer's home — Unbound Galleries (HOSTING_SPEC.md).
 * First visit activates the account; after that it's galleries + new.
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

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-12 px-6 pb-24 pt-8 sm:px-12">
        {!account ? (
          <section className="flex flex-col gap-6">
            <div className="flex flex-col gap-3">
              <p className="text-xs uppercase tracking-[0.3em] text-slate">
                Unbound Galleries
              </p>
              <h1 className="font-display text-5xl text-parchment">
                Deliver like it matters.
              </h1>
              <p className="max-w-md text-sm leading-relaxed text-pewter">
                Client galleries with unlimited traffic and downloads. Your
                photos are never deleted without your say-so.
              </p>
            </div>
            <ActivateForm />
          </section>
        ) : (
          <>
            <header className="flex flex-col gap-2">
              <p className="text-xs uppercase tracking-[0.3em] text-slate">
                {account.business_name}
              </p>
              <h1 className="font-display text-5xl text-parchment">
                {galleries && galleries.length > 0
                  ? "Your galleries."
                  : "Your first gallery."}
              </h1>
            </header>

            {galleries && galleries.length > 0 ? (
              <ul className="flex flex-col gap-px overflow-hidden rounded-md border border-stone">
                {galleries.map((gallery) => (
                  <li key={gallery.id}>
                    <Link
                      href={`/galleries/${gallery.id}`}
                      className="flex items-center justify-between gap-4 bg-charcoal px-5 py-4 transition-colors hover:bg-stone"
                    >
                      <span className="flex flex-col gap-1">
                        <span className="text-base text-parchment">
                          {gallery.title}
                        </span>
                        {gallery.event_date ? (
                          <span className="text-xs text-slate">
                            {gallery.event_date}
                          </span>
                        ) : null}
                      </span>
                      <span aria-hidden className="text-pewter">
                        →
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : null}

            <section className="flex flex-col gap-5 border-t border-stone pt-10">
              <h2 className="font-display text-3xl text-parchment">
                New gallery.
              </h2>
              <NewGalleryForm />
            </section>
          </>
        )}
      </main>
    </div>
  );
}
