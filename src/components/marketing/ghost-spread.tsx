"use client";

import { useEffect, useState } from "react";

import { TEMPLATES_BY_CODE } from "@/lib/engine/templates";

/**
 * The landing page has no couple's photos to show — so it shows the design
 * itself. A ghost spread draws a real template's slot geometry as quiet
 * ink-on-parchment blocks: the actual layouts couples receive, as abstract
 * composition. No stock photography, no fake weddings.
 */

const SHOWCASE = ["M4", "D1", "T4", "H2", "M5"] as const;

export function GhostSpread({ code }: { code: string }) {
  const template = TEMPLATES_BY_CODE.get(code);
  if (!template) return null;
  return (
    <div
      aria-hidden
      className="relative w-full overflow-hidden rounded-[3px] bg-parchment shadow-[0_1px_60px_rgba(0,0,0,0.55)]"
      style={{ aspectRatio: "2 / 1" }}
    >
      {template.slots.map((slot) => (
        <div
          key={slot.id}
          className={slot.emphasis ? "absolute bg-ink/15" : "absolute bg-ink/[0.07]"}
          style={{
            left: `${slot.rect.x * 100}%`,
            top: `${slot.rect.y * 100}%`,
            width: `${slot.rect.w * 100}%`,
            height: `${slot.rect.h * 100}%`,
          }}
        />
      ))}
      {/* The fold — every spread is one sheet, folded at the center. */}
      <div className="absolute inset-y-0 left-1/2 w-10 -translate-x-1/2 bg-gradient-to-r from-transparent via-ink/10 to-transparent" />
    </div>
  );
}

export function GhostSpreadShowcase() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(
      () => setIndex((i) => (i + 1) % SHOWCASE.length),
      3800,
    );
    return () => clearInterval(id);
  }, []);

  const active = TEMPLATES_BY_CODE.get(SHOWCASE[index]);

  return (
    <figure className="flex w-full flex-col items-center gap-6">
      <div className="w-full">
        <div className="relative w-full" style={{ aspectRatio: "2 / 1" }}>
          {SHOWCASE.map((code, i) => (
            <div
              key={code}
              className={`absolute inset-0 transition-opacity duration-700 ${
                i === index ? "opacity-100" : "opacity-0"
              }`}
            >
              <GhostSpread code={code} />
            </div>
          ))}
        </div>
        {/* The page block beneath — this is a bound book, not a slide. */}
        <div aria-hidden className="mx-auto mt-[3px] h-px w-[99%] bg-linen/70" />
        <div aria-hidden className="mx-auto mt-[3px] h-px w-[97%] bg-linen/40" />
        <div aria-hidden className="mx-auto mt-[3px] h-px w-[95%] bg-linen/20" />
      </div>
      <figcaption className="text-center">
        <span className="font-display text-xl italic text-parchment">
          {active?.name}
        </span>
        <span className="mt-1 block text-xs text-slate">
          One of twenty-three ways a page can hold your day.
        </span>
      </figcaption>
    </figure>
  );
}
