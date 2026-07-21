"use client";

import { useEffect, useReducer, useRef, useState } from "react";

/**
 * The homepage demo — three beats on a loop, using REAL photos from a live
 * gallery (not mockup boxes):
 *
 *   1. upload    photos fly in, progress fills
 *   2. gallery   they settle into a justified grid, share link appears
 *   3. arrange   "Arrange with AI" is pressed; the grid reflows and one photo
 *                becomes a highlight tile
 *
 * Pure CSS transforms on absolutely-positioned tiles — no animation library,
 * no video, nothing to go stale. Honors prefers-reduced-motion by holding the
 * finished state.
 */

type Phase = "upload" | "gallery" | "arranging" | "arranged";

const PHASE_MS: Record<Phase, number> = {
  upload: 2600,
  gallery: 2400,
  arranging: 1400,
  arranged: 3400,
};

const NEXT: Record<Phase, Phase> = {
  upload: "gallery",
  gallery: "arranging",
  arranging: "arranged",
  arranged: "upload",
};

/** Percentage boxes: [left, top, width, height]. */
type Box = [number, number, number, number];

const EVEN_GRID: Box[] = [
  [0, 0, 32, 48],
  [34, 0, 32, 48],
  [68, 0, 32, 48],
  [0, 52, 32, 48],
  [34, 52, 32, 48],
  [68, 52, 32, 48],
];

/** After the AI pass: photo 2 is promoted to a highlight, the rest re-flow. */
const ARRANGED: Box[] = [
  [51, 0, 23.5, 32],
  [76.5, 0, 23.5, 32],
  [0, 0, 49, 100], // the highlight
  [51, 34, 49, 32],
  [51, 68, 23.5, 32],
  [76.5, 68, 23.5, 32],
];

const HIGHLIGHT_INDEX = 2;

export function HowItWorksDemo({ photoUrls }: { photoUrls: string[] }) {
  const [phase, setPhase] = useState<Phase>("upload");
  const [reduced, setReduced] = useState(false);
  const [, forceTick] = useReducer((n: number) => n + 1, 0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reduced-motion check is deferred: setting state synchronously inside an
  // effect cascades renders (and trips react-hooks/set-state-in-effect).
  useEffect(() => {
    const id = setTimeout(() => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        setReduced(true);
        setPhase("arranged");
      }
    }, 0);
    return () => clearTimeout(id);
  }, []);

  useEffect(() => {
    if (reduced) return;
    timer.current = setTimeout(() => {
      setPhase((p) => NEXT[p]);
      forceTick();
    }, PHASE_MS[phase]);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [phase, reduced]);

  const photos = photoUrls.slice(0, 6);
  const showArranged = phase === "arranged";
  const boxes = showArranged ? ARRANGED : EVEN_GRID;
  const uploading = phase === "upload";

  const caption =
    phase === "upload"
      ? "Uploading — resumable, thousands at a time"
      : phase === "gallery"
        ? "Your gallery is live"
        : phase === "arranging"
          ? "Arranging…"
          : "Arranged — one photo leads";

  return (
    <figure className="m-0">
      <div className="overflow-hidden rounded-xl border border-line bg-neutral-0 shadow-lg">
        {/* Chrome bar */}
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <div className="flex items-center gap-1.5" aria-hidden>
            <span className="h-2.5 w-2.5 rounded-full bg-well" />
            <span className="h-2.5 w-2.5 rounded-full bg-well" />
            <span className="h-2.5 w-2.5 rounded-full bg-well" />
          </div>
          <span
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors duration-500 ${
              uploading
                ? "bg-well text-muted"
                : "bg-accent-soft text-accent"
            }`}
          >
            {uploading ? "Uploading" : "Public"}
          </span>
        </div>

        {/* Stage */}
        <div className="relative px-4 pb-4 pt-4">
          <div className="relative w-full" style={{ aspectRatio: "16 / 10" }}>
            {photos.map((url, i) => {
              const [left, top, width, height] = boxes[i] ?? EVEN_GRID[i];
              const isHighlight = showArranged && i === HIGHLIGHT_INDEX;
              // During upload each tile waits its turn below the frame.
              const pending = uploading;
              return (
                <div
                  key={i}
                  className="absolute overflow-hidden rounded-md bg-well"
                  style={{
                    left: `${left}%`,
                    top: `${pending ? top + 60 : top}%`,
                    width: `${width}%`,
                    height: `${height}%`,
                    opacity: pending ? 0 : 1,
                    transition: reduced
                      ? "none"
                      : `left .9s cubic-bezier(.16,1,.3,1) ${i * 60}ms, top .9s cubic-bezier(.16,1,.3,1) ${i * 60}ms, width .9s cubic-bezier(.16,1,.3,1) ${i * 60}ms, height .9s cubic-bezier(.16,1,.3,1) ${i * 60}ms, opacity .5s ease ${i * 90}ms, box-shadow .5s ease`,
                    boxShadow: isHighlight
                      ? "0 0 0 2px var(--color-accent)"
                      : "none",
                    zIndex: isHighlight ? 2 : 1,
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={url}
                    alt=""
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                  {isHighlight ? (
                    <span className="absolute left-2 top-2 rounded-full bg-accent px-2 py-0.5 text-[11px] font-medium text-neutral-0">
                      Highlight
                    </span>
                  ) : null}
                </div>
              );
            })}
          </div>

          {/* Upload progress */}
          <div
            className="mt-4 h-1 w-full overflow-hidden rounded-full bg-well transition-opacity duration-500"
            style={{ opacity: uploading ? 1 : 0 }}
            aria-hidden
          >
            <div
              className="h-1 rounded-full bg-accent"
              style={{
                width: uploading ? "100%" : "0%",
                transition: reduced ? "none" : "width 2.4s linear",
              }}
            />
          </div>

          {/* The AI button — pressed during the "arranging" beat */}
          <div className="mt-4 flex items-center justify-between gap-4">
            <p className="text-sm text-muted" aria-live="polite">
              {caption}
            </p>
            <span
              className={`inline-flex shrink-0 items-center gap-2 rounded-md px-3.5 py-2 text-xs font-medium transition-all duration-300 ${
                phase === "arranging"
                  ? "scale-95 bg-accent-hover text-neutral-0"
                  : showArranged
                    ? "bg-accent-soft text-accent"
                    : "bg-accent text-neutral-0"
              }`}
              style={{ opacity: uploading ? 0.35 : 1 }}
            >
              <span
                aria-hidden
                className={phase === "arranging" ? "animate-pulse" : ""}
              >
                ✦
              </span>
              {showArranged ? "Undo" : "Arrange with AI"}
            </span>
          </div>
        </div>
      </div>
      <figcaption className="mt-3 text-center text-xs text-faint">
        Upload, share, and let the layout arrange itself — revert any time.
      </figcaption>
    </figure>
  );
}
