import Link from "next/link";

import { GhostEditor } from "@/components/marketing/ghost-editor";
import { GhostSpreadShowcase } from "@/components/marketing/ghost-spread";
import { Reveal } from "@/components/marketing/reveal";
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

const STATS = [
  { value: "15", label: "spreads — thirty lay-flat pages" },
  { value: "23", label: "layouts, chosen page by page" },
  { value: "250", label: "DPI print files, preview and print identical" },
  { value: "$0", label: "until you order the book" },
];

const SIZE_NOTES: Record<string, string> = {
  "10x10": "The classic square.",
  "12x12": "The statement square.",
  "11x14": "The grand portrait.",
};

const FAQ = [
  {
    q: "How many photos should we upload?",
    a: "Around 150 — your favorites, not the whole gallery. Two hundred is the ceiling. If you can't choose, bring the maybes: when a photo doesn't make the book, we tell you why.",
  },
  {
    q: "Do we have to design anything?",
    a: "No. Your album arrives designed — every page composed, the day in order. Then it's yours: change as much or as little as you like.",
  },
  {
    q: "What if we don't love a page?",
    a: "Ask for a redesign and we take another pass — a different treatment of the same moment, up to three per page. Or swap, reframe, and reorder yourself. Every change is one undo away.",
  },
  {
    q: "Is the preview really free?",
    a: "Yes. The whole book, every page, before you pay anything. You pay only when you order the printed album.",
  },
  {
    q: "Are our photos private?",
    a: "Yes. Your album is yours alone until you share it — one link, made for family, hidden from search engines.",
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
      {/* Nav — fixed, with a scrim so the wordmark survives every section. */}
      <header className="fixed inset-x-0 top-0 z-40 bg-gradient-to-b from-ink via-ink/75 to-transparent">
        <div className="flex items-center justify-between px-6 pb-8 pt-6 sm:px-10">
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
        </div>
      </header>

      {/* Hero */}
      <section className="flex flex-col items-center px-6 pb-24 pt-36 text-center sm:pt-48">
        <h1 className="font-display text-5xl text-parchment sm:text-7xl md:text-8xl">
          Your love story, <em>unbound.</em>
        </h1>
        <p className="mt-7 max-w-md text-sm leading-relaxed text-pewter sm:text-base">
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

        <div className="mt-24 w-full max-w-3xl">
          <GhostSpreadShowcase />
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="mx-auto max-w-5xl scroll-mt-16 px-6 py-24">
        <Reveal>
          <p className="text-xs uppercase tracking-[0.3em] text-slate">
            How it works
          </p>
          <h2 className="mt-4 max-w-xl font-display text-4xl text-parchment sm:text-5xl">
            An album, not a project.
          </h2>
        </Reveal>
        <div className="mt-14 grid gap-12 sm:grid-cols-3 sm:gap-10">
          {STEPS.map((step, i) => (
            <Reveal key={step.number} delay={i * 120}>
              <div className="flex flex-col gap-3">
                <span className="text-xs tracking-[0.3em] text-slate">
                  {step.number}
                </span>
                <h3 className="font-display text-2xl text-parchment">
                  {step.title}
                </h3>
                <p className="text-sm leading-relaxed text-pewter">
                  {step.body}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* The editor */}
      <section className="mx-auto max-w-5xl px-6 py-24">
        <div className="grid items-center gap-12 lg:grid-cols-[5fr_6fr] lg:gap-16">
          <Reveal>
            <p className="text-xs uppercase tracking-[0.3em] text-slate">
              The editor
            </p>
            <h2 className="mt-4 font-display text-4xl text-parchment sm:text-5xl">
              Every page is yours to change.
            </h2>
            <p className="mt-5 max-w-md text-sm leading-relaxed text-pewter">
              Swap a photo, reframe a crop, try another layout — or ask us to
              take another pass at a page, and tell us what it should lead
              with. Everything saves itself. Everything undoes.
            </p>
            <blockquote className="mt-8 border-l border-stone pl-5">
              <p className="font-display text-xl italic leading-snug text-parchment">
                &ldquo;Led with the black-and-white skyline silhouette as the
                anchor — the tenderest, most striking frame of your
                portraits.&rdquo;
              </p>
              <cite className="mt-3 block text-xs not-italic text-slate">
                — the note that came with one couple&rsquo;s redesign
              </cite>
            </blockquote>
          </Reveal>
          <Reveal delay={150}>
            <GhostEditor />
          </Reveal>
        </div>
      </section>

      {/* Curation — the light section for rhythm */}
      <section className="bg-parchment px-6 py-28 text-ink">
        <Reveal className="mx-auto flex max-w-2xl flex-col items-center gap-6 text-center">
          <h2 className="font-display text-4xl sm:text-5xl">
            Fifty photos of the sunset? We&rsquo;ll pick the one.
          </h2>
          <p className="max-w-lg text-sm leading-relaxed text-stone sm:text-base">
            An album isn&rsquo;t everything that happened — it&rsquo;s
            everything worth turning to again. When a photo doesn&rsquo;t make
            the cut, we tell you why. One tap brings it back.
          </p>
        </Reveal>
      </section>

      {/* The book — stats, sizes, pricing */}
      <section className="mx-auto max-w-5xl px-6 py-24">
        <Reveal>
          <p className="text-xs uppercase tracking-[0.3em] text-slate">
            The book
          </p>
          <h2 className="mt-4 font-display text-4xl text-parchment sm:text-5xl">
            One album. Three sizes.
          </h2>
          <p className="mt-4 max-w-lg text-sm leading-relaxed text-pewter">
            {BASE_SPREAD_COUNT} spreads of thick, lay-flat pages in a hardcover
            — one flat price, whichever photos you bring.
          </p>
        </Reveal>

        <div className="mt-14 grid grid-cols-2 gap-x-6 gap-y-10 border-y border-stone py-10 sm:grid-cols-4">
          {STATS.map((stat, i) => (
            <Reveal key={stat.value} delay={i * 100}>
              <div className="flex flex-col gap-2">
                <span className="font-display text-5xl text-parchment">
                  {stat.value}
                </span>
                <span className="max-w-[16ch] text-xs leading-relaxed text-slate">
                  {stat.label}
                </span>
              </div>
            </Reveal>
          ))}
        </div>

        <div className="mt-14 grid gap-4 sm:grid-cols-3">
          {ALBUM_SIZES.map((size, i) => {
            const spec = ALBUM_SIZE_SPECS[size];
            const hero = size === DEFAULT_ALBUM_SIZE;
            return (
              <Reveal key={size} delay={i * 100}>
                <div
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
                      {SIZE_NOTES[size]}
                    </span>
                  </div>
                </div>
              </Reveal>
            );
          })}
        </div>
      </section>

      {/* Founder note — the honest kind of social proof */}
      <section className="bg-parchment px-6 py-28 text-ink">
        <Reveal className="mx-auto flex max-w-2xl flex-col gap-8">
          <p className="text-xs uppercase tracking-[0.3em] text-slate">
            Why this exists
          </p>
          <p className="font-display text-3xl leading-snug sm:text-4xl">
            I&rsquo;ve spent a decade photographing weddings, and here is the
            industry&rsquo;s quiet truth: most couples never finish their
            album. Not because they don&rsquo;t care — because the tools ask
            them to be designers. Unbound asks for your favorites and hands
            back a book.
          </p>
          <div className="flex flex-col gap-0.5">
            <span className="font-display text-2xl italic">Alex Knight</span>
            <span className="text-xs text-slate">
              Founder — wedding photographer
            </span>
          </div>
        </Reveal>
      </section>

      {/* FAQ */}
      <section className="mx-auto max-w-2xl px-6 py-24">
        <Reveal>
          <p className="text-xs uppercase tracking-[0.3em] text-slate">
            Questions
          </p>
          <h2 className="mt-4 font-display text-4xl text-parchment">
            The things couples ask.
          </h2>
        </Reveal>
        <div className="mt-10">
          {FAQ.map((item) => (
            <Reveal key={item.q}>
              <details className="group border-b border-stone py-5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm text-parchment [&::-webkit-details-marker]:hidden">
                  {item.q}
                  <span
                    aria-hidden
                    className="text-pewter transition-transform duration-200 group-open:rotate-45"
                  >
                    +
                  </span>
                </summary>
                <p className="mt-3 max-w-xl text-sm leading-relaxed text-pewter">
                  {item.a}
                </p>
              </details>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="px-6 py-28">
        <Reveal className="mx-auto flex max-w-2xl flex-col items-center gap-6 text-center">
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
        </Reveal>
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
