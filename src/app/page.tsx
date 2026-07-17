import Link from "next/link";

import { GhostSpreadShowcase } from "@/components/marketing/ghost-spread";
import {
  ALBUM_SIZES,
  ALBUM_SIZE_SPECS,
  BASE_SPREAD_COUNT,
  DEFAULT_ALBUM_SIZE,
  formatPrice,
} from "@/lib/albums/sizes";
import { createClient } from "@/lib/supabase/server";

const STEPS = [
  {
    number: "01",
    title: "Choose your favorites.",
    body: "Around 150 photos — the ones you keep coming back to. No sorting, no folders, no captions.",
  },
  {
    number: "02",
    title: "We design every page.",
    body: "Every photo is studied — the light, the moment, who's in it. Your album opens on a panorama and tells the day in order.",
  },
  {
    number: "03",
    title: "Make it yours.",
    body: "Preview the whole book free. Swap photos, reframe crops, redesign a page. Order when it's exactly right.",
  },
];

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const ctaHref = user ? "/albums" : "/login";
  const ctaLabel = user ? "Your albums" : "Create your album";

  return (
    <main className="flex-1">
      {/* Nav */}
      <header className="absolute inset-x-0 top-0 z-10 flex items-center justify-between px-6 py-6 sm:px-10">
        <Link
          href="/"
          className="text-xs tracking-[0.35em] text-parchment"
          aria-label="Unbound Albums home"
        >
          UNBOUND
        </Link>
        <Link
          href={ctaHref}
          className="text-xs tracking-widest text-pewter transition-colors hover:text-parchment"
        >
          {user ? "YOUR ALBUMS" : "SIGN IN"}
        </Link>
      </header>

      {/* Hero */}
      <section className="flex flex-col items-center px-6 pb-24 pt-36 text-center sm:pt-44">
        <h1 className="font-display text-5xl text-parchment sm:text-7xl">
          Your love story, <em>unbound.</em>
        </h1>
        <p className="mt-6 max-w-md text-sm leading-relaxed text-pewter sm:text-base">
          Your favorite wedding photos, designed into a printed album — every
          page composed, every moment in order. Upload around 150. We&rsquo;ll
          do the rest.
        </p>
        <div className="mt-10 flex flex-col items-center gap-5 sm:flex-row">
          <Link
            href={ctaHref}
            className="rounded-md bg-parchment px-8 py-3.5 text-sm text-ink transition-opacity hover:opacity-90"
          >
            {ctaLabel}
          </Link>
          <a
            href="#how"
            className="text-sm text-pewter underline-offset-4 transition-colors hover:text-parchment hover:underline"
          >
            See how it works
          </a>
        </div>

        <div className="mt-20 w-full max-w-3xl">
          <GhostSpreadShowcase />
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="mx-auto max-w-5xl scroll-mt-16 px-6 py-24">
        <p className="text-xs uppercase tracking-[0.3em] text-slate">
          How it works
        </p>
        <h2 className="mt-4 max-w-xl font-display text-4xl text-parchment sm:text-5xl">
          An album, not a project.
        </h2>
        <div className="mt-14 grid gap-12 sm:grid-cols-3 sm:gap-10">
          {STEPS.map((step) => (
            <div key={step.number} className="flex flex-col gap-3">
              <span className="text-xs tracking-[0.3em] text-slate">
                {step.number}
              </span>
              <h3 className="font-display text-2xl text-parchment">
                {step.title}
              </h3>
              <p className="text-sm leading-relaxed text-pewter">{step.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Curation — the light section for rhythm */}
      <section className="bg-parchment px-6 py-24 text-ink">
        <div className="mx-auto flex max-w-2xl flex-col items-center gap-6 text-center">
          <h2 className="font-display text-4xl sm:text-5xl">
            Fifty photos of the sunset? We&rsquo;ll pick the one.
          </h2>
          <p className="max-w-lg text-sm leading-relaxed text-stone sm:text-base">
            An album isn&rsquo;t everything that happened — it&rsquo;s
            everything worth turning to again. When a photo doesn&rsquo;t make
            the cut, we tell you why. One tap brings it back.
          </p>
        </div>
      </section>

      {/* Sizes & pricing */}
      <section className="mx-auto max-w-5xl px-6 py-24">
        <p className="text-xs uppercase tracking-[0.3em] text-slate">
          The book
        </p>
        <h2 className="mt-4 font-display text-4xl text-parchment sm:text-5xl">
          One album. Three sizes.
        </h2>
        <p className="mt-4 max-w-lg text-sm leading-relaxed text-pewter">
          {BASE_SPREAD_COUNT} spreads — {BASE_SPREAD_COUNT * 2} lay-flat pages,
          hardcover, one flat price. The preview is free; you pay only when you
          order the book.
        </p>
        <div className="mt-12 grid gap-4 sm:grid-cols-3">
          {ALBUM_SIZES.map((size) => {
            const spec = ALBUM_SIZE_SPECS[size];
            const hero = size === DEFAULT_ALBUM_SIZE;
            return (
              <div
                key={size}
                className={`flex flex-col gap-6 rounded-md border p-6 ${
                  hero ? "border-pewter" : "border-stone"
                }`}
              >
                {/* The page itself, to scale against its siblings. */}
                <div className="flex h-[88px] items-end" aria-hidden>
                  <div
                    className="rounded-[2px] border border-pewter/60 bg-charcoal"
                    style={{
                      width: `${spec.pageWidthIn * 6}px`,
                      height: `${spec.pageHeightIn * 6}px`,
                    }}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="font-display text-2xl text-parchment">
                      {spec.label}
                    </span>
                    <span className="text-sm text-pewter">
                      {formatPrice(spec.priceCents)}
                    </span>
                  </div>
                  <span className="text-xs text-slate">
                    {hero ? "The classic square." : size === "11x14" ? "The grand portrait." : "The statement square."}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Final CTA */}
      <section className="px-6 py-28">
        <div className="mx-auto flex max-w-2xl flex-col items-center gap-6 text-center">
          <h2 className="font-display text-4xl text-parchment sm:text-5xl">
            See your album before you buy it.
          </h2>
          <p className="text-sm text-pewter">
            The whole book, designed and ready to page through — free.
          </p>
          <Link
            href={ctaHref}
            className="mt-2 rounded-md bg-parchment px-8 py-3.5 text-sm text-ink transition-opacity hover:opacity-90"
          >
            {ctaLabel}
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="flex flex-col items-center justify-between gap-3 border-t border-stone px-6 py-10 text-center sm:flex-row sm:px-10 sm:text-left">
        <span className="text-xs tracking-[0.35em] text-pewter">
          UNBOUND ALBUMS
        </span>
        <span className="text-xs text-slate">
          Made by a wedding photographer.
        </span>
      </footer>
    </main>
  );
}
