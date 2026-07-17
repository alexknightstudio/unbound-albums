/* eslint-disable @next/next/no-img-element */
import Link from "next/link";

import { MarketingNav } from "@/components/marketing/marketing-nav";
import { Reveal } from "@/components/marketing/reveal";
import {
  ALBUM_SIZES,
  ALBUM_SIZE_SPECS,
  BASE_SPREAD_COUNT,
  DOWNLOAD_PRICE_CENTS,
  formatPrice,
} from "@/lib/albums/sizes";
import { createClient } from "@/lib/supabase/server";

/**
 * The marketing site — implemented from the Claude Design build of
 * SITE_SPEC.md ("Unbound Marketing Site" project, Unbound Design System).
 * Artifact Uprising's method in our monochrome: editorial rhythm, permanence
 * positioning, materials-as-story. The abstract album compositions (Blush /
 * Sage / Cream / Warm Gray) are photography stand-ins per the spec — swap
 * one-for-one when real beta-album photography lands. UI chrome stays
 * monochrome.
 */

const STEPS = [
  {
    number: "01",
    title: "Choose your favorites",
    body: "Pick around 150 photos from your gallery. That's the only work you'll do.",
  },
  {
    number: "02",
    title: "A designer builds your book",
    body: "A professional album designer composes every page — color, light, and feeling, in the order your day unfolded. The studio reviews every album before you see it.",
  },
  {
    number: "03",
    title: "Hold it in your hands",
    body: "Your proof arrives in one to three days. Adjust anything. Print when it's perfect. Hardcover at your door.",
  },
];

/* Placeholder gallery + pull quotes per SITE_SPEC Section 6 — replaced with
 * real beta couples (photos, names, words) before launch. Not real people. */
const GALLERY_CAPTIONS = [
  "Sofia & Marc — Tulum, October",
  "Priya & Dev — Hudson Valley, June",
  "Elena & Theo — Lake Como, September",
];

const QUOTES = [
  {
    quote: "It's the first thing people pick up in our living room. Every single time.",
    who: "Sofia & Marc · Tulum",
  },
  {
    quote: "Our photographer asked who designed it. We just smiled.",
    who: "Priya & Dev · Hudson Valley",
  },
  {
    quote: "We turned every page on the couch and cried all over again.",
    who: "Elena & Theo · Lake Como",
  },
];

/* ————— Abstract album art (photography stand-ins) ————— */

function Fold({ width = 56, strength = 0.16 }: { width?: number; strength?: number }) {
  return (
    <div
      className="pointer-events-none absolute inset-y-0 left-1/2 -translate-x-1/2"
      style={{
        width,
        background: `linear-gradient(to right, rgba(10,10,10,0) 0%, rgba(10,10,10,${strength}) 50%, rgba(10,10,10,0) 100%)`,
      }}
    />
  );
}

function HeroBook() {
  return (
    <div aria-hidden className="relative">
      <div
        className="relative flex overflow-hidden rounded-[4px] shadow-[0_50px_110px_-18px_rgba(0,0,0,0.75),0_24px_48px_-24px_rgba(0,0,0,0.8)]"
        style={{ aspectRatio: "2.02 / 1" }}
      >
        <div
          className="relative flex-1"
          style={{ background: "linear-gradient(118deg, #DBB2A3 0%, #D4A89A 55%, #C69682 100%)" }}
        >
          <div
            className="absolute shadow-[0_10px_24px_rgba(0,0,0,0.18)]"
            style={{ left: "10%", bottom: "13%", width: "32%", aspectRatio: "3 / 4", background: "#F5E6D3" }}
          />
        </div>
        <div className="relative flex-1" style={{ background: "#F7F4EE" }}>
          <div style={{ position: "absolute", left: "14%", top: "13%", width: "52%", aspectRatio: "4 / 3", background: "#9CAF88" }} />
          <div style={{ position: "absolute", left: "14%", top: "60%", width: "21%", height: 2, background: "#C9C2B6" }} />
          <div style={{ position: "absolute", left: "14%", top: "64%", width: "13%", height: 2, background: "#D5CFC4" }} />
          <div style={{ position: "absolute", right: "10%", bottom: "12%", width: "28%", aspectRatio: "1 / 1", background: "#B8AFA6" }} />
        </div>
        <Fold />
      </div>
      <div className="mx-auto h-[3px] w-[98.4%]" style={{ background: "#E6E1D7" }} />
      <div className="mx-auto h-[3px] w-[96.8%] rounded-b-[3px]" style={{ background: "#D8D2C7" }} />
    </div>
  );
}

function PagesMock() {
  return (
    <div
      aria-hidden
      className="flex items-center justify-center border"
      style={{ aspectRatio: "4 / 3", background: "#F4F1EB", borderColor: "#E0DDD8" }}
    >
      <div style={{ width: "72%" }}>
        <div
          className="relative flex overflow-hidden rounded-[2px] shadow-[0_26px_48px_-16px_rgba(26,26,24,0.35)]"
          style={{ aspectRatio: "2 / 1" }}
        >
          <div className="flex-1" style={{ background: "linear-gradient(100deg, #D9AE9F 0%, #D4A89A 100%)" }} />
          <div className="flex-1" style={{ background: "linear-gradient(80deg, #D4A89A 0%, #CFA090 100%)" }} />
          <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: "30%", background: "#F5E6D3" }} />
          <Fold width={26} strength={0.1} />
        </div>
        {[
          ["98.6%", "#EDE8DE"],
          ["97.2%", "#E0DACE"],
          ["95.8%", "#D6CFC2"],
          ["94.4%", "#CCC5B7"],
        ].map(([w, c]) => (
          <div key={c} className="mx-auto h-[2.5px]" style={{ width: w, background: c }} />
        ))}
      </div>
    </div>
  );
}

function CoverMock() {
  return (
    <div
      aria-hidden
      className="relative flex items-center justify-center border"
      style={{ aspectRatio: "4 / 3", background: "#F4F1EB", borderColor: "#E0DDD8" }}
    >
      <div
        className="flex flex-col items-center justify-center rounded-[4px] shadow-[0_24px_44px_-14px_rgba(26,26,24,0.5)]"
        style={{ width: "46%", aspectRatio: "1 / 1", gap: "8%", background: "linear-gradient(145deg, #26241F 0%, #1C1A16 100%)" }}
      >
        <div
          className="rounded-full"
          style={{ width: "26%", aspectRatio: "1 / 1", background: "#D4A89A", border: "1px solid rgba(233,220,195,0.55)", boxShadow: "inset 0 0 0 4px #1C1A16" }}
        />
        <div className="font-display italic" style={{ fontSize: "clamp(16px, 1.7vw, 23px)", letterSpacing: 1, color: "#E9DCC3", fontWeight: 400 }}>
          Sofia &amp; Marc
        </div>
        <div className="text-xs uppercase" style={{ letterSpacing: 2.5, color: "rgba(233,220,195,0.55)" }}>
          October 2025
        </div>
      </div>
      <div className="absolute flex gap-2.5" style={{ bottom: "6.5%", left: "50%", transform: "translateX(-50%)" }}>
        {["#23211D", "#B8AFA6", "#8A7F72"].map((c) => (
          <div key={c} className="h-5 w-5 rounded-[3px]" style={{ background: c, border: "1px solid #D8D2C8" }} />
        ))}
      </div>
    </div>
  );
}

function SizesMock() {
  return (
    <div
      aria-hidden
      className="flex items-center justify-center border"
      style={{ aspectRatio: "4 / 3", background: "#F4F1EB", borderColor: "#E0DDD8" }}
    >
      <div className="relative" style={{ height: "76%", aspectRatio: "1 / 1" }}>
        {[
          { label: "11×14", width: "75.3%", height: "95.9%", fill: undefined },
          { label: "12×12", width: "82.2%", height: "82.2%", fill: undefined },
          { label: "10×10", width: "68.5%", height: "68.5%", fill: "rgba(245,230,211,0.55)" },
        ].map((box) => (
          <div
            key={box.label}
            className="absolute bottom-0 left-0 border border-ink"
            style={{ width: box.width, height: box.height, background: box.fill }}
          >
            <span className="absolute right-2.5 top-2 text-xs text-slate" style={{ letterSpacing: 0.5 }}>
              {box.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function DifferenceSpread() {
  return (
    <div
      aria-hidden
      className="flex items-center justify-center border border-stone"
      style={{ aspectRatio: "4 / 3", background: "#131210" }}
    >
      <div
        className="relative flex overflow-hidden rounded-[2px] shadow-[0_34px_64px_-18px_rgba(0,0,0,0.8)]"
        style={{ width: "78%", aspectRatio: "2 / 1" }}
      >
        <div className="relative flex-1" style={{ background: "#F2EEE6" }}>
          <div style={{ position: "absolute", left: "12%", top: "14%", width: "58%", aspectRatio: "4 / 5", background: "#9CAF88" }} />
          <div style={{ position: "absolute", left: "12%", top: "78%", width: "24%", height: 2, background: "#C9C2B6" }} />
        </div>
        <div className="relative flex-1" style={{ background: "#F6F3EC" }}>
          <div style={{ position: "absolute", right: "12%", top: "24%", width: "62%", aspectRatio: "4 / 3", background: "#D4A89A" }} />
          <div style={{ position: "absolute", right: "12%", top: "68%", width: "30%", height: 2, background: "#C9C2B6" }} />
          <div style={{ position: "absolute", right: "12%", top: "73%", width: "18%", height: 2, background: "#D5CFC4" }} />
        </div>
        <Fold width={30} strength={0.14} />
      </div>
    </div>
  );
}

function ShelfTile({
  background,
  shelfColor,
  children,
}: {
  background: string;
  shelfColor: string;
  children: React.ReactNode;
}) {
  return (
    <div
      aria-hidden
      className="relative overflow-hidden border"
      style={{ aspectRatio: "4 / 5", background, borderColor: "#E0DDD8" }}
    >
      <div style={{ position: "absolute", left: "9%", right: "9%", top: "74%", height: 1, background: shelfColor }} />
      {children}
    </div>
  );
}

function GalleryTiles() {
  return (
    <>
      <Reveal delay={100}>
        <ShelfTile background="#EFEBE4" shelfColor="#D9D4CC">
          <div
            className="absolute flex flex-col items-center justify-center rounded-[3px] shadow-[0_20px_32px_-14px_rgba(26,26,24,0.45)]"
            style={{ left: "50%", top: "74%", transform: "translate(-50%, -100%)", width: "54%", aspectRatio: "1 / 1", gap: "9%", background: "linear-gradient(150deg, #27251F 0%, #1C1A16 100%)" }}
          >
            <div className="rounded-full" style={{ width: "24%", aspectRatio: "1 / 1", background: "#D4A89A", border: "1px solid rgba(233,220,195,0.5)", boxShadow: "inset 0 0 0 3px #1C1A16" }} />
            <div className="font-display text-[15px] italic" style={{ color: "#E9DCC3", fontWeight: 400 }}>Sofia &amp; Marc</div>
          </div>
        </ShelfTile>
        <p className="mt-4 font-display text-lg italic text-slate">{GALLERY_CAPTIONS[0]}</p>
      </Reveal>
      <Reveal delay={200}>
        <ShelfTile background="#EAE5DC" shelfColor="#D6D0C6">
          <div style={{ position: "absolute", left: "50%", top: "74%", transform: "translate(-50%, -100%)", width: "74%" }}>
            <div
              className="relative flex overflow-hidden rounded-[2px] shadow-[0_20px_32px_-14px_rgba(26,26,24,0.4)]"
              style={{ aspectRatio: "2 / 1" }}
            >
              <div className="flex-1" style={{ background: "linear-gradient(100deg, #D9AE9F 0%, #D4A89A 100%)" }} />
              <div className="relative flex-1" style={{ background: "#F6F3EC" }}>
                <div style={{ position: "absolute", left: "16%", top: "18%", width: "54%", aspectRatio: "1 / 1", background: "#B8AFA6" }} />
                <div style={{ position: "absolute", left: "16%", top: "74%", width: "26%", height: 2, background: "#C9C2B6" }} />
              </div>
              <Fold width={20} strength={0.12} />
            </div>
            <div className="mx-auto h-[2px] w-[97%]" style={{ background: "#DDD7CB" }} />
            <div className="mx-auto h-[2px] w-[94%]" style={{ background: "#D0C9BB" }} />
          </div>
        </ShelfTile>
        <p className="mt-4 font-display text-lg italic text-slate">{GALLERY_CAPTIONS[1]}</p>
      </Reveal>
      <Reveal delay={300}>
        <ShelfTile background="#F1EDE6" shelfColor="#DBD6CD">
          <div
            className="absolute flex flex-col items-center justify-center rounded-[3px] shadow-[0_20px_32px_-14px_rgba(26,26,24,0.4)]"
            style={{ left: "50%", top: "74%", transform: "translate(-50%, -100%)", width: "54%", aspectRatio: "1 / 1", gap: "9%", background: "linear-gradient(150deg, #BFB6AC 0%, #B0A79C 100%)" }}
          >
            <div className="rounded-full" style={{ width: "24%", aspectRatio: "1 / 1", background: "#F5E6D3", border: "1px solid rgba(107,105,96,0.4)", boxShadow: "inset 0 0 0 3px #B0A79C" }} />
            <div className="font-display text-[15px] italic" style={{ color: "#3A362F", fontWeight: 400 }}>Elena &amp; Theo</div>
          </div>
        </ShelfTile>
        <p className="mt-4 font-display text-lg italic text-slate">{GALLERY_CAPTIONS[2]}</p>
      </Reveal>
    </>
  );
}

/* ————— The page ————— */

const CTA_PRIMARY =
  "inline-flex items-center justify-center rounded-md bg-white px-8 py-4 text-xs font-medium uppercase tracking-[2px] text-ink transition-shadow hover:shadow-[0_4px_20px_rgba(255,255,255,0.15)] active:scale-[0.98] sm:text-sm";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const ctaHref = user ? "/albums" : "/login";

  return (
    <main className="flex-1 text-[17px] leading-[1.7] tracking-[0.2px]">
      <MarketingNav ctaHref={ctaHref} />

      {/* Section 1 — Hero */}
      <section id="hero" className="relative overflow-hidden bg-ink px-6 pb-24 sm:px-10">
        <div className="mx-auto max-w-6xl pt-[clamp(140px,18vh,200px)] text-center">
          <h1 className="font-display text-[clamp(48px,6.6vw,80px)] font-light leading-[1.06] tracking-[-0.5px] text-white [text-wrap:balance]">
            Your love story, <em className="italic">unbound.</em>
          </h1>
          <p className="mx-auto mt-7 max-w-[560px] text-base leading-[1.7] text-pewter sm:text-lg [text-wrap:pretty]">
            Your wedding photos, designed into an album you&rsquo;ll hold for
            the rest of your life. Designed for you in days. Printed for
            decades.
          </p>
          <div className="mt-11 flex flex-wrap items-center justify-center gap-3.5">
            <Link href={ctaHref} className={CTA_PRIMARY}>
              Start Your Album — Free Design
            </Link>
            <a
              href="#how"
              className="inline-flex items-center justify-center rounded-md border border-white/30 px-8 py-4 text-xs font-medium uppercase tracking-[2px] text-white transition-colors hover:border-white hover:bg-white hover:text-ink active:scale-[0.98] sm:text-sm"
            >
              See How It Works
            </a>
          </div>
          <p className="mt-6 text-sm text-slate">
            The design is free. Pay only to print.
          </p>
        </div>
        <div className="relative mx-auto mt-[clamp(56px,8vh,96px)] w-full max-w-[900px]">
          <div
            aria-hidden
            className="pointer-events-none absolute"
            style={{
              inset: "-160px -180px -120px",
              background:
                "radial-gradient(ellipse 52% 55% at 50% 32%, rgba(228,186,148,0.16) 0%, rgba(228,186,148,0.05) 48%, rgba(228,186,148,0) 72%)",
            }}
          />
          <Reveal delay={300} className="relative">
            <HeroBook />
          </Reveal>
        </div>
      </section>

      {/* Section 2 — The permanence statement */}
      <section className="bg-parchment px-6 py-[clamp(110px,13vw,170px)] text-center sm:px-16">
        <div className="mx-auto max-w-[640px]">
          <Reveal>
            <p className="font-display text-[clamp(30px,3.4vw,38px)] leading-[1.2] tracking-[0.5px] text-ink" style={{ fontWeight: 400 }}>
              You took a thousand photos that day.
            </p>
          </Reveal>
          <Reveal delay={120}>
            <p className="mt-[52px] font-display text-[clamp(30px,3.4vw,38px)] leading-[1.2] tracking-[0.5px] text-ink" style={{ fontWeight: 400 }}>
              You&rsquo;ll frame maybe one.
            </p>
          </Reveal>
          <Reveal delay={220}>
            <p className="mt-16 font-display text-[clamp(26px,2.9vw,38px)] italic leading-[1.3] text-slate [text-wrap:balance]" style={{ fontWeight: 400 }}>
              We think you deserve the other nine hundred and ninety-nine.
            </p>
          </Reveal>
          <Reveal delay={300}>
            <div className="mx-auto mt-[72px] h-px w-20 bg-pewter" />
          </Reveal>
        </div>
      </section>

      {/* Section 3 — How it works */}
      <section id="how" className="scroll-mt-16 bg-ink px-6 py-[clamp(110px,13vw,170px)] sm:px-16">
        <div className="mx-auto max-w-6xl">
          <Reveal>
            <p className="text-xs font-medium uppercase tracking-[3px] text-pewter">
              How It Works
            </p>
          </Reveal>
          <Reveal delay={80}>
            <h2 className="mt-6 max-w-[760px] font-display text-[clamp(38px,4.4vw,52px)] font-light leading-[1.15] text-white [text-wrap:balance]">
              Three steps. Then it&rsquo;s on your shelf forever.
            </h2>
          </Reveal>
          <div className="mt-[clamp(64px,7vw,100px)] grid gap-[clamp(48px,5vw,72px)] sm:grid-cols-3">
            {STEPS.map((step, i) => (
              <Reveal key={step.number} delay={100 + i * 100}>
                <div className="flex items-center gap-6">
                  <span className="font-display text-[clamp(56px,5vw,72px)] font-light leading-[0.9] text-white">
                    {step.number}
                  </span>
                  <span className="h-px flex-1 bg-stone" />
                </div>
                <h3 className="mt-7 font-display text-[25px] tracking-[0.5px] text-parchment" style={{ fontWeight: 500 }}>
                  {step.title}
                </h3>
                <p className="mt-3.5 max-w-[340px] text-[15px] leading-[1.7] tracking-[0.3px] text-pewter [text-wrap:pretty]">
                  {step.body}
                </p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Section 4 — The album itself */}
      <section id="album" className="scroll-mt-16 bg-parchment px-6 py-[clamp(110px,13vw,170px)] sm:px-16">
        <div className="mx-auto max-w-6xl">
          <Reveal>
            <p className="text-xs font-medium uppercase tracking-[3px] text-slate">
              The Album
            </p>
          </Reveal>
          <Reveal delay={80}>
            <h2 className="mt-6 font-display text-[clamp(38px,4.4vw,52px)] font-light leading-[1.15] text-ink">
              Premium in every detail.
            </h2>
          </Reveal>

          {[
            {
              title: "The pages",
              body: "Thick, archival, layflat. Spreads open completely flat so a full-bleed photo runs uninterrupted across both pages.",
              art: <PagesMock />,
              direction: "left" as const,
              flip: false,
            },
            {
              title: "The cover",
              body: "Leather, linen, or velvet. A cameo if you like. Your names in foil, in a face you chose.",
              art: <CoverMock />,
              direction: "right" as const,
              flip: true,
            },
            {
              title: "The sizes",
              body: "10×10, 12×12, or 11×14. Fifteen spreads — thirty lay-flat pages. Built to be handed to someone.",
              art: <SizesMock />,
              direction: "left" as const,
              flip: false,
            },
          ].map((row) => (
            <Reveal key={row.title} direction={row.direction}>
              <div
                className={`mt-[clamp(64px,7vw,110px)] flex flex-wrap items-center gap-[clamp(40px,6vw,96px)] ${
                  row.flip ? "flex-row-reverse" : ""
                }`}
              >
                <div className="min-w-[280px] max-w-[620px] flex-[1_1_440px]">{row.art}</div>
                <div className="max-w-[460px] flex-[1_1_320px]">
                  <h3 className="font-display text-[clamp(28px,3vw,36px)] leading-[1.2] tracking-[0.5px] text-ink" style={{ fontWeight: 400 }}>
                    {row.title}
                  </h3>
                  <p className="mt-4 max-w-[440px] text-[17px] leading-[1.75] text-slate [text-wrap:pretty]">
                    {row.body}
                  </p>
                </div>
              </div>
            </Reveal>
          ))}

          <Reveal>
            <p className="mt-[clamp(72px,9vw,120px)] text-center text-[15px] tracking-[0.3px] text-slate">
              Printed by the same professional labs wedding photographers use.
            </p>
          </Reveal>
        </div>
      </section>

      {/* Section 5 — The design difference */}
      <section className="bg-ink px-6 py-[clamp(110px,13vw,170px)] sm:px-16">
        <div className="mx-auto max-w-6xl">
          <Reveal>
            <p className="text-xs font-medium uppercase tracking-[3px] text-pewter">
              The Difference
            </p>
          </Reveal>
          <Reveal delay={80}>
            <h2 className="mt-6 max-w-[880px] font-display text-[clamp(36px,4.2vw,50px)] font-light leading-[1.18] text-white [text-wrap:balance]">
              Album designers charge $800 and take six weeks. We disagree with
              both numbers.
            </h2>
          </Reveal>
          <div className="mt-[clamp(56px,6vw,88px)] flex flex-wrap items-center gap-[clamp(40px,6vw,96px)]">
            <Reveal delay={100} className="max-w-[520px] flex-[1_1_340px]">
              <p className="text-[17px] leading-[1.8] text-pewter [text-wrap:pretty]">
                Every album is designed by a professional — balancing color and
                light across spreads, pairing quiet detail shots against big
                moments, letting your best photographs breathe on their own
                page.
              </p>
              <p className="mt-6 text-[17px] leading-[1.8] text-parchment [text-wrap:pretty]">
                The difference is you see yours in days, free, before spending
                a dollar.
              </p>
            </Reveal>
            <Reveal direction="right" delay={150} className="min-w-[280px] max-w-[620px] flex-[1_1_420px]">
              <DifferenceSpread />
            </Reveal>
          </div>
          <div className="mt-[clamp(64px,7vw,96px)] grid gap-8 sm:grid-cols-3">
            {["A person, not a template", "Reviewed by the studio", "Revisions until it's right"].map(
              (item, i) => (
                <Reveal key={item} delay={100 + i * 80}>
                  <p className="border-l border-stone px-6 py-1.5 text-[15px] tracking-[0.5px] text-parchment">
                    {item}
                  </p>
                </Reveal>
              ),
            )}
          </div>
        </div>
      </section>

      {/* Section 6 — Real albums, real shelves */}
      <section className="bg-parchment px-6 py-[clamp(110px,13vw,170px)] sm:px-16">
        <div className="mx-auto max-w-6xl">
          <Reveal>
            <p className="text-xs font-medium uppercase tracking-[3px] text-slate">
              In the Wild
            </p>
          </Reveal>
          <Reveal delay={80}>
            <h2 className="mt-6 font-display text-[clamp(38px,4.4vw,52px)] font-light leading-[1.15] text-ink">
              Made to be left out.
            </h2>
          </Reveal>
          <div className="mt-[clamp(56px,6vw,80px)] grid gap-[clamp(28px,3vw,40px)] sm:grid-cols-3">
            <GalleryTiles />
          </div>
          <div className="mt-[clamp(72px,8vw,110px)] grid gap-[clamp(40px,5vw,64px)] sm:grid-cols-3">
            {QUOTES.map((q, i) => (
              <Reveal key={q.who} delay={100 + i * 100}>
                <div className="h-px w-10 bg-ink" />
                <p className="mt-5 font-display text-[clamp(21px,2vw,24px)] italic leading-[1.45] text-charcoal [text-wrap:pretty]" style={{ fontWeight: 400 }}>
                  {q.quote}
                </p>
                <p className="mt-4 text-xs font-medium uppercase tracking-[2px] text-slate">
                  {q.who}
                </p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Section 7 — Pricing */}
      <section id="pricing" className="scroll-mt-16 bg-ink px-6 py-[clamp(110px,13vw,170px)] sm:px-16">
        <div className="mx-auto max-w-6xl">
          <Reveal>
            <p className="text-xs font-medium uppercase tracking-[3px] text-pewter">
              Pricing
            </p>
          </Reveal>
          <Reveal delay={80}>
            <h2 className="mt-6 max-w-[760px] font-display text-[clamp(38px,4.4vw,52px)] font-light leading-[1.15] text-white [text-wrap:balance]">
              One album. One price. No subscriptions.
            </h2>
          </Reveal>
          <div className="mt-[clamp(64px,7vw,96px)] grid gap-y-14 sm:grid-cols-3">
            {ALBUM_SIZES.map((size, i) => {
              const spec = ALBUM_SIZE_SPECS[size];
              return (
                <Reveal key={size} delay={100 + i * 80}>
                  <div className="border-l border-stone px-6 py-2.5 lg:px-12">
                    <p className="text-xs font-medium uppercase tracking-[3px] text-pewter">
                      {spec.label}
                    </p>
                    <p className="mt-5 font-display text-[clamp(46px,4.6vw,60px)] font-light leading-none text-white">
                      {formatPrice(spec.priceCents)}
                    </p>
                    <p className="mt-4 text-sm leading-[1.7] tracking-[0.3px] text-pewter">
                      {BASE_SPREAD_COUNT} spreads · hardcover layflat · free
                      shipping.
                    </p>
                  </div>
                </Reveal>
              );
            })}
          </div>
          <Reveal className="mx-auto mt-[clamp(64px,7vw,88px)] max-w-[640px] text-center">
            <p className="text-[15px] leading-[1.8] text-slate">
              Additional copies 30% off — parents always want their own.
            </p>
            <p className="mt-3 text-[15px] leading-[1.8] text-pewter">
              The design and every proof are free — a flip-through you can
              share before paying anything.
            </p>
            <p className="mt-3 text-[15px] leading-[1.8] text-slate">
              Prefer to print elsewhere? The print-ready files are{" "}
              {formatPrice(DOWNLOAD_PRICE_CENTS)}.
            </p>
            <div className="mt-12 flex justify-center">
              <Link href={ctaHref} className={CTA_PRIMARY}>
                Start Your Album
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Section 8 — The closing argument */}
      <section className="bg-parchment px-6 py-[clamp(110px,13vw,170px)] text-center sm:px-16">
        <div className="mx-auto max-w-[620px]">
          <Reveal>
            <p className="font-display text-[clamp(28px,3vw,34px)] leading-[1.35] tracking-[0.5px] text-ink [text-wrap:balance]" style={{ fontWeight: 400 }}>
              Someday, someone you love will pull this off a shelf and ask you
              to tell the story.
            </p>
          </Reveal>
          <Reveal delay={120}>
            <p className="mt-10 font-display text-[clamp(26px,2.9vw,38px)] italic leading-[1.3] text-slate" style={{ fontWeight: 400 }}>
              Nobody ever handed down a hard drive.
            </p>
          </Reveal>
          <Reveal delay={220}>
            <div className="mt-14 flex justify-center">
              <Link
                href={ctaHref}
                className="inline-flex items-center justify-center rounded-md bg-ink px-9 py-4 text-xs font-medium uppercase tracking-[2px] text-white transition-all hover:bg-charcoal hover:shadow-[0_4px_20px_rgba(10,10,10,0.2)] active:scale-[0.98] sm:text-sm"
              >
                Start Your Album — Free
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-6 py-[clamp(80px,9vw,120px)] text-center sm:px-16" style={{ background: "#050505" }}>
        <div className="mx-auto flex max-w-6xl flex-col items-center">
          <img
            src="/unbound-wordmark-white.png"
            alt="UNBOUND"
            className="-my-2 block h-10 w-auto opacity-55"
          />
          <p className="mt-6 font-display text-xl italic text-pewter" style={{ fontWeight: 400 }}>
            Your love story, unbound.
          </p>
          <div className="mt-10 h-px w-20 bg-stone" />
          <div className="mt-10 flex flex-wrap justify-center gap-6 sm:gap-11">
            {["Privacy", "Terms", "Instagram", "Contact"].map((label) => (
              <span
                key={label}
                className="text-xs uppercase tracking-[2px] text-slate"
              >
                {label}
              </span>
            ))}
          </div>
          <p className="mt-9 text-xs tracking-[0.5px] text-slate">
            © 2026 Unbound Albums.
          </p>
        </div>
      </footer>
    </main>
  );
}
