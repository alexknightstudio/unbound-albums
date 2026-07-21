/* eslint-disable @next/next/no-img-element */
import Link from "next/link";

import { Reveal } from "@/components/marketing/reveal";
import { formatPlanPrice, PLANS } from "@/lib/plans";
import { createClient } from "@/lib/supabase/server";

/**
 * The marketing site — tokens v1 (approved 2026-07-21), audience: anyone
 * (PLATFORM_SPEC §12 Q2, answered). Light photo-SaaS, Pixieset-class calm:
 * whites, one accent, photos are the point. No fake stats, no fake reviews.
 */

const VALUE_PROPS = [
  {
    title: "Beautiful by default",
    body: "Fast, editorial galleries with full-screen viewing that feels native on a phone. Your photos do the talking — the interface stays out of the way.",
  },
  {
    title: "Private or public — per gallery",
    body: "Deliver a password-protected gallery to a client, or publish a portfolio anyone can find. One home for both.",
  },
  {
    title: "Traffic is free, forever",
    body: "Share a gallery with five hundred guests and let every one of them download everything. It costs you nothing — that's how we built it.",
  },
];

function HeroMock() {
  const tiles = [
    { w: "32%", ar: "3 / 2", bg: "#DCE3EC" },
    { w: "23%", ar: "2 / 3", bg: "#E8E2D9" },
    { w: "41%", ar: "16 / 9", bg: "#D7DDD3" },
    { w: "27%", ar: "1 / 1", bg: "#E3DAD5" },
    { w: "44%", ar: "3 / 2", bg: "#D9E0E7" },
    { w: "25%", ar: "2 / 3", bg: "#E6E6E0" },
  ];
  return (
    <div
      aria-hidden
      className="rounded-xl border border-line bg-neutral-0 p-3 shadow-lg sm:p-4"
    >
      <div className="mb-3 flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-well" />
          <span className="h-2.5 w-2.5 rounded-full bg-well" />
          <span className="h-2.5 w-2.5 rounded-full bg-well" />
        </div>
        <span className="rounded-full bg-accent-soft px-3 py-1 text-xs font-medium text-accent">
          Public
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        {tiles.map((t, i) => (
          <div
            key={i}
            className="grow rounded-md"
            style={{ flexBasis: t.w, aspectRatio: t.ar, background: t.bg }}
          />
        ))}
      </div>
    </div>
  );
}

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const ctaHref = user ? "/galleries" : "/login";

  return (
    <main className="flex-1 bg-neutral-0 text-body">
      {/* Nav */}
      <header className="sticky top-0 z-40 border-b border-line bg-neutral-0/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link href="/" aria-label="Unbound — home" className="flex items-center">
            <img src="/unbound-wordmark-ink.png" alt="Unbound" className="block h-3.5 w-auto" />
          </Link>
          <div className="flex items-center gap-2 sm:gap-6">
            <a href="#pricing" className="hidden text-sm font-medium text-muted transition-colors hover:text-heading sm:block">
              Pricing
            </a>
            <Link href="/login" className="text-sm font-medium text-muted transition-colors hover:text-heading">
              Sign in
            </Link>
            <Link
              href={ctaHref}
              className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-neutral-0 shadow-xs transition-colors hover:bg-accent-hover"
            >
              Get started free
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-6 pb-20 pt-16 sm:pb-28 sm:pt-24">
        <div className="mx-auto max-w-2xl text-center">
          <h1 className="text-4xl font-semibold tracking-tight text-heading sm:text-6xl [text-wrap:balance]">
            Your photos, hosted beautifully.
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-muted sm:text-lg [text-wrap:pretty]">
            Upload thousands of photos and share them as fast, gorgeous
            galleries — private for clients, public for the world. Unlimited
            traffic and downloads, and nothing is ever deleted without your
            say-so.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href={ctaHref}
              className="rounded-md bg-accent px-6 py-3 text-sm font-medium text-neutral-0 shadow-sm transition-colors hover:bg-accent-hover"
            >
              Get started free
            </Link>
            <a
              href="#pricing"
              className="rounded-md border border-line-strong bg-neutral-0 px-6 py-3 text-sm font-medium text-body shadow-xs transition-colors hover:bg-well"
            >
              See pricing
            </a>
          </div>
          <p className="mt-4 text-sm text-faint">
            Free plan, no card. 10 GB to start.
          </p>
        </div>
        <Reveal className="mx-auto mt-14 max-w-3xl">
          <HeroMock />
        </Reveal>
      </section>

      {/* Value props */}
      <section className="border-t border-line bg-canvas">
        <div className="mx-auto grid max-w-6xl gap-10 px-6 py-20 sm:grid-cols-3 sm:gap-8">
          {VALUE_PROPS.map((prop, i) => (
            <Reveal key={prop.title} delay={i * 100}>
              <h2 className="text-lg font-semibold text-heading">{prop.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted [text-wrap:pretty]">
                {prop.body}
              </p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* For photographers */}
      <section className="mx-auto max-w-6xl px-6 py-20 sm:py-24">
        <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
          <Reveal>
            <p className="text-sm font-medium text-accent">For working photographers</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-heading [text-wrap:balance]">
              Deliver a whole wedding without babysitting an upload.
            </h2>
            <ul className="mt-6 flex flex-col gap-4 text-sm leading-relaxed text-muted">
              <li className="flex gap-3">
                <span aria-hidden className="mt-0.5 text-accent">✓</span>
                Resumable uploads built for thousands of JPEGs — a dropped
                connection or closed laptop picks up where it left off.
              </li>
              <li className="flex gap-3">
                <span aria-hidden className="mt-0.5 text-accent">✓</span>
                Password-protected client galleries with unlimited guests and
                unlimited downloads.
              </li>
              <li className="flex gap-3">
                <span aria-hidden className="mt-0.5 text-accent">✓</span>
                No forced expiry, ever. A lapsed plan pauses uploads — it never
                deletes a client&rsquo;s photos.
              </li>
              <li className="flex gap-3">
                <span aria-hidden className="mt-0.5 text-accent">✓</span>
                Storage-honest pricing. You pay for shelf space, never for
                traffic.
              </li>
            </ul>
          </Reveal>
          <Reveal delay={120}>
            <div className="rounded-xl border border-line bg-neutral-0 p-6 shadow-md">
              <p className="text-sm font-medium text-heading">Uploading — 412 photos</p>
              <div className="mt-3 h-1.5 rounded-full bg-well">
                <div className="h-1.5 w-3/4 rounded-full bg-accent" />
              </div>
              <p className="mt-2 text-xs text-faint">
                309 delivered · resumes automatically
              </p>
              <div className="mt-5 border-t border-line pt-4">
                <p className="text-sm font-medium text-heading">Sofia &amp; Marc — Tulum</p>
                <p className="mt-0.5 text-xs text-muted">Private · password · 6 photos</p>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Trust */}
      <section className="border-y border-line bg-canvas">
        <div className="mx-auto max-w-2xl px-6 py-16 text-center">
          <Reveal>
            <h2 className="text-2xl font-semibold tracking-tight text-heading">
              We never delete your galleries.
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-muted [text-wrap:pretty]">
              Photo platforms have a habit of holding photos hostage — archives
              that lock, links that expire, galleries that vanish over a missed
              payment. Not here. Deleting is something only you can do.
            </p>
          </Reveal>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="mx-auto max-w-6xl scroll-mt-20 px-6 py-20 sm:py-24">
        <Reveal className="text-center">
          <h2 className="text-3xl font-semibold tracking-tight text-heading">
            Storage-honest pricing.
          </h2>
          <p className="mx-auto mt-3 max-w-md text-sm text-muted">
            Every plan has unlimited galleries, guests, traffic, and downloads.
            You choose how much shelf space you need.
          </p>
        </Reveal>
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PLANS.map((plan, i) => {
            const featured = plan.id === "solo";
            return (
              <Reveal key={plan.id} delay={i * 80}>
                <div
                  className={`flex h-full flex-col gap-4 rounded-xl border bg-neutral-0 p-6 ${
                    featured
                      ? "border-accent shadow-md"
                      : "border-line shadow-xs"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-heading">{plan.label}</span>
                    {featured ? (
                      <span className="rounded-full bg-accent-soft px-2.5 py-0.5 text-xs font-medium text-accent">
                        Popular
                      </span>
                    ) : null}
                  </div>
                  <div>
                    <span className="text-3xl font-semibold text-heading">
                      {formatPlanPrice(plan.annualMonthlyCents)}
                    </span>
                    <span className="text-sm text-faint">/mo</span>
                    {plan.monthlyCents > 0 ? (
                      <p className="mt-0.5 text-xs text-faint">
                        billed annually · {formatPlanPrice(plan.monthlyCents)} monthly
                      </p>
                    ) : (
                      <p className="mt-0.5 text-xs text-faint">no card required</p>
                    )}
                  </div>
                  <p className="text-sm font-medium text-body">
                    {plan.storageGb >= 1000
                      ? `${plan.storageGb / 1000} TB`
                      : `${plan.storageGb} GB`}{" "}
                    storage
                    {plan.seats > 1 ? ` · ${plan.seats} seats` : ""}
                  </p>
                  <p className="text-sm leading-relaxed text-muted">{plan.blurb}</p>
                  <Link
                    href={ctaHref}
                    className={`mt-auto rounded-md px-4 py-2.5 text-center text-sm font-medium transition-colors ${
                      featured
                        ? "bg-accent text-neutral-0 hover:bg-accent-hover"
                        : "border border-line-strong bg-neutral-0 text-body hover:bg-well"
                    }`}
                  >
                    {plan.id === "free" ? "Start free" : "Choose " + plan.label}
                  </Link>
                </div>
              </Reveal>
            );
          })}
        </div>
        <p className="mt-6 text-center text-xs text-faint">
          Over your cap? $6 per 100 GB, opt-in only — we warn you first, and we
          never delete. Prices are launch placeholders.
        </p>
      </section>

      {/* Final CTA */}
      <section className="border-t border-line bg-canvas">
        <div className="mx-auto max-w-2xl px-6 py-20 text-center">
          <Reveal>
            <h2 className="text-3xl font-semibold tracking-tight text-heading">
              Put your photos somewhere that respects them.
            </h2>
            <Link
              href={ctaHref}
              className="mt-6 inline-block rounded-md bg-accent px-6 py-3 text-sm font-medium text-neutral-0 shadow-sm transition-colors hover:bg-accent-hover"
            >
              Get started free
            </Link>
          </Reveal>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-line bg-neutral-0">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-10 sm:flex-row">
          <img src="/unbound-wordmark-ink.png" alt="Unbound" className="h-3 w-auto opacity-60" />
          <p className="text-xs text-faint">© 2026 Unbound.</p>
        </div>
      </footer>
    </main>
  );
}
