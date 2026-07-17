"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { SpreadRenderer } from "@/components/spreads/spread-renderer";

import type { AlbumSizeSpec } from "@/lib/albums/sizes";

export type ViewerSpread = {
  id: string;
  position: number;
  template_code: string;
  slots: Record<string, string>;
};

/**
 * The album, spread by spread. Scroll-snap does the heavy lifting: swiping
 * works on a phone because it's native scrolling, not a gesture library.
 * Arrows and keyboard for desktop; the filmstrip is the map.
 */
export function AlbumViewer({
  spreads,
  photoUrls,
  sizeSpec,
}: {
  spreads: ViewerSpread[];
  photoUrls: Record<string, string>;
  sizeSpec: AlbumSizeSpec;
}) {
  const [index, setIndex] = useState(0);
  const trackRef = useRef<HTMLDivElement>(null);
  const photosById = new Map(
    Object.entries(photoUrls).map(([id, url]) => [id, { url }]),
  );

  const scrollTo = useCallback((i: number) => {
    const track = trackRef.current;
    if (!track) return;
    const clamped = Math.max(0, Math.min(i, track.children.length - 1));
    const current = Math.round(track.scrollLeft / track.clientWidth);
    // Explicit scrollTo, not scrollIntoView (unreliable inside snap
    // containers). Smooth only for adjacent moves: snap-mandatory captures
    // long smooth scrolls at the first snap point, so filmstrip jumps land
    // instantly instead of not at all.
    track.scrollTo({
      left: clamped * track.clientWidth,
      behavior: Math.abs(clamped - current) <= 1 ? "smooth" : "auto",
    });
  }, []);

  // Current spread follows the scroll position, whatever caused it —
  // swipe, arrows, filmstrip, keyboard.
  const onScroll = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;
    const i = Math.round(track.scrollLeft / track.clientWidth);
    setIndex(Math.max(0, Math.min(i, spreads.length - 1)));
  }, [spreads.length]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "ArrowRight") scrollTo(index + 1);
      if (event.key === "ArrowLeft") scrollTo(index - 1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, scrollTo]);

  if (spreads.length === 0) return null;

  return (
    <div className="flex flex-col gap-4">
      {/* The book */}
      <div
        ref={trackRef}
        onScroll={onScroll}
        className="scrollbar-none flex snap-x snap-mandatory overflow-x-auto"
        style={{ scrollbarWidth: "none" }}
      >
        {spreads.map((spread) => (
          <div key={spread.id} className="w-full shrink-0 snap-center px-px">
            <SpreadRenderer
              templateCode={spread.template_code}
              slots={spread.slots}
              photosById={photosById}
              sizeSpec={sizeSpec}
              showFold
              className="shadow-[0_1px_40px_rgba(0,0,0,0.55)]"
            />
          </div>
        ))}
      </div>

      {/* Position + arrows */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => scrollTo(index - 1)}
          disabled={index === 0}
          aria-label="Previous spread"
          className="rounded-md border border-stone px-4 py-2 text-sm text-pewter transition-colors hover:border-pewter hover:text-parchment disabled:opacity-30"
        >
          ←
        </button>
        <p className="text-xs tracking-widest text-slate">
          SPREAD {index + 1} OF {spreads.length}
        </p>
        <button
          type="button"
          onClick={() => scrollTo(index + 1)}
          disabled={index === spreads.length - 1}
          aria-label="Next spread"
          className="rounded-md border border-stone px-4 py-2 text-sm text-pewter transition-colors hover:border-pewter hover:text-parchment disabled:opacity-30"
        >
          →
        </button>
      </div>

      {/* Filmstrip — the same renderer, tiny */}
      <div className="scrollbar-none flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
        {spreads.map((spread, i) => (
          <button
            key={spread.id}
            type="button"
            onClick={() => scrollTo(i)}
            aria-label={`Go to spread ${i + 1}`}
            className={`w-24 shrink-0 overflow-hidden rounded-sm border transition-colors ${
              i === index ? "border-parchment" : "border-stone opacity-60 hover:opacity-100"
            }`}
          >
            <SpreadRenderer
              templateCode={spread.template_code}
              slots={spread.slots}
              photosById={photosById}
              sizeSpec={sizeSpec}
            />
          </button>
        ))}
      </div>
    </div>
  );
}
