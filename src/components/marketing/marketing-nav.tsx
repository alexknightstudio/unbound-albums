"use client";

/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { useEffect, useState } from "react";

/**
 * The marketing nav — transparent over the hero, Charcoal-scrim with blur
 * once scrolled. Straight from the Claude Design build of SITE_SPEC.md:
 * wordmark, three anchors, one white button. No dropdowns.
 */
export function MarketingNav({ ctaHref }: { ctaHref: string }) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 32);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav className="fixed inset-x-0 top-0 z-50">
      <div
        aria-hidden
        className={`absolute inset-0 border-b border-white/5 bg-ink/70 backdrop-blur-xl transition-opacity duration-300 ${
          scrolled ? "opacity-100" : "opacity-0"
        }`}
      />
      <div className="relative mx-auto flex max-w-7xl items-center justify-between gap-6 px-6 py-4 sm:px-10">
        <Link href="/" aria-label="Unbound — home" className="flex items-center">
          <img
            src="/unbound-wordmark-white.png"
            alt="UNBOUND"
            className="-my-2 block h-9 w-auto"
          />
        </Link>
        <div className="flex items-center gap-6 lg:gap-10">
          <div className="hidden items-center gap-6 md:flex lg:gap-9">
            {[
              { href: "#how", label: "How It Works" },
              { href: "#album", label: "The Album" },
              { href: "#pricing", label: "Pricing" },
            ].map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="text-xs uppercase tracking-[2px] text-pewter transition-colors hover:text-white hover:underline hover:underline-offset-[7px]"
              >
                {item.label}
              </a>
            ))}
          </div>
          <Link
            href={ctaHref}
            className="whitespace-nowrap rounded-md bg-white px-5 py-2.5 text-xs font-medium uppercase tracking-[1.8px] text-ink transition-shadow hover:shadow-[0_4px_20px_rgba(255,255,255,0.15)] active:scale-[0.98]"
          >
            Start Your Album
          </Link>
        </div>
      </div>
    </nav>
  );
}
