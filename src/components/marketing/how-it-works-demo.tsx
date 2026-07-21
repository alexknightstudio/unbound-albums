"use client";

import { useEffect, useRef, useState } from "react";

/**
 * The homepage demo — a small film, on a loop, starring REAL photographs from
 * a live gallery (never mockup boxes):
 *
 *   reach → grab → drag → drop → upload → expand → gallery → arrange
 *
 * A cursor picks up a stack of photos, drags them into the drop zone, the zone
 * swells and fills with the gallery, then "Arrange with AI" is pressed and the
 * grid reflows with one photo promoted to a highlight.
 *
 * Absolutely-positioned tiles + CSS transitions on left/top/width/height. No
 * animation library, no video, nothing to go stale. prefers-reduced-motion
 * holds the finished state.
 */

type Phase =
  | "reach"
  | "grab"
  | "drag"
  | "drop"
  | "uploading"
  | "expand"
  | "gallery"
  | "arranging"
  | "arranged";

const PHASE_MS: Record<Phase, number> = {
  reach: 1100,
  grab: 700,
  drag: 1500,
  drop: 550,
  uploading: 1700,
  expand: 1100,
  gallery: 1500,
  arranging: 900,
  arranged: 3200,
};

const NEXT: Record<Phase, Phase> = {
  reach: "grab",
  grab: "drag",
  drag: "drop",
  drop: "uploading",
  uploading: "expand",
  expand: "gallery",
  gallery: "arranging",
  arranging: "arranged",
  arranged: "reach",
};

/** Percentage boxes: [left, top, width, height]. */
type Box = [number, number, number, number];

const EVEN_GRID: Box[] = [
  [0, 0, 32, 49],
  [34, 0, 32, 49],
  [68, 0, 32, 49],
  [0, 51, 32, 49],
  [34, 51, 32, 49],
  [68, 51, 32, 49],
];

/** After the AI pass: photo 3 is promoted, the rest re-flow around it. */
const ARRANGED: Box[] = [
  [51, 0, 23.5, 49], // tall column A
  [76.5, 0, 23.5, 32], // column B stacks three
  [0, 0, 49, 100], // the highlight — a full-height portrait
  [51, 51, 23.5, 49],
  [76.5, 34, 23.5, 32],
  [76.5, 68, 23.5, 32],
];

const HIGHLIGHT_INDEX = 2;

/** Cursor position per phase, in stage percentages. */
const CURSOR: Partial<Record<Phase, [number, number]>> = {
  reach: [6, 96],
  grab: [15, 84],
  drag: [48, 44],
  drop: [48, 44],
  uploading: [48, 44],
  expand: [60, 60],
  gallery: [88, 104],
  arranging: [88, 104],
  arranged: [96, 118],
};

const CAPTION: Record<Phase, string> = {
  reach: "Your photos, wherever they live",
  grab: "Grab the whole shoot",
  drag: "Drag them in",
  drop: "Drop",
  uploading: "Uploading — resumable, thousands at a time",
  expand: "Building your gallery",
  gallery: "Your gallery is live",
  arranging: "Arranging…",
  arranged: "Arranged — one photo leads",
};

function CursorArrow({ pressed }: { pressed: boolean }) {
  return (
    <span className="relative block">
      {pressed ? (
        <span className="absolute -left-2 -top-2 block h-8 w-8 animate-ping rounded-full bg-accent/30" />
      ) : null}
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden
        style={{ filter: "drop-shadow(0 2px 4px rgba(16,24,40,0.35))" }}
      >
        <path
          d="M5 2.5L18.5 12.5H11.5L8.5 20L5 2.5Z"
          fill="white"
          stroke="#101828"
          strokeWidth="1.4"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

export function HowItWorksDemo({ photoUrls }: { photoUrls: string[] }) {
  const [phase, setPhase] = useState<Phase>("reach");
  const [reduced, setReduced] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Deferred: setting state synchronously inside an effect cascades renders.
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
    timer.current = setTimeout(
      () => setPhase((p) => NEXT[p]),
      PHASE_MS[phase],
    );
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [phase, reduced]);

  const photos = photoUrls.slice(0, 6);

  const beforeDrop = phase === "reach" || phase === "grab" || phase === "drag";
  const holding = phase === "grab" || phase === "drag" || phase === "drop";
  const showStack = beforeDrop || phase === "drop";
  const dropZoneActive = phase === "drag" || phase === "drop";
  const zoneVisible =
    beforeDrop || phase === "drop" || phase === "uploading" || phase === "expand";
  const gridVisible =
    phase === "expand" ||
    phase === "gallery" ||
    phase === "arranging" ||
    phase === "arranged";
  const showArranged = phase === "arranged";
  const boxes = showArranged ? ARRANGED : EVEN_GRID;
  const [cx, cy] = CURSOR[phase] ?? [50, 50];
  const ease = "cubic-bezier(.16,1,.3,1)";

  // The dragged stack travels from the corner into the zone.
  const stackPos: [number, number] =
    phase === "reach" ? [3, 74] : phase === "grab" ? [11, 62] : [44, 30];

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
              gridVisible ? "bg-accent-soft text-accent" : "bg-well text-muted"
            }`}
          >
            {gridVisible ? "Public" : "New gallery"}
          </span>
        </div>

        {/* Stage */}
        <div className="relative px-4 pb-4 pt-4">
          <div
            className="relative w-full overflow-hidden"
            style={{ aspectRatio: "4 / 3" }}
          >
            {/* Drop zone — swells when the photos land, then hands off to the grid */}
            <div
              className="absolute rounded-lg border-2 border-dashed transition-all duration-700"
              style={{
                left: zoneVisible && !gridVisible ? "14%" : "0%",
                top: zoneVisible && !gridVisible ? "14%" : "0%",
                width: zoneVisible && !gridVisible ? "72%" : "100%",
                height: zoneVisible && !gridVisible ? "62%" : "100%",
                borderColor: dropZoneActive
                  ? "var(--color-accent)"
                  : "var(--color-line-strong)",
                background: dropZoneActive
                  ? "var(--color-accent-soft)"
                  : "var(--color-canvas)",
                opacity: zoneVisible ? 1 : 0,
                transitionTimingFunction: ease,
              }}
            >
              <span
                className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-center transition-opacity duration-300"
                style={{ opacity: phase === "uploading" ? 1 : dropZoneActive ? 0.9 : 0.7 }}
              >
                <span className="text-sm font-medium text-heading">
                  {phase === "uploading" ? "6 photos" : "Drop photos here"}
                </span>
                <span className="text-xs text-muted">
                  {phase === "uploading" ? "Uploading…" : "or choose from your computer"}
                </span>
              </span>
            </div>

            {/* The gallery grid */}
            {photos.map((url, i) => {
              const [left, top, width, height] = boxes[i] ?? EVEN_GRID[i];
              const isHighlight = showArranged && i === HIGHLIGHT_INDEX;
              return (
                <div
                  key={i}
                  className="absolute overflow-hidden rounded-md bg-well"
                  style={{
                    left: `${left}%`,
                    top: `${top}%`,
                    width: `${width}%`,
                    height: `${height}%`,
                    opacity: gridVisible ? 1 : 0,
                    transform: gridVisible ? "scale(1)" : "scale(.86)",
                    transition: reduced
                      ? "none"
                      : `left .85s ${ease} ${i * 55}ms, top .85s ${ease} ${i * 55}ms, width .85s ${ease} ${i * 55}ms, height .85s ${ease} ${i * 55}ms, opacity .5s ease ${i * 70}ms, transform .6s ${ease} ${i * 70}ms, box-shadow .4s ease`,
                    boxShadow: isHighlight ? "0 0 0 2px var(--color-accent)" : "none",
                    zIndex: isHighlight ? 2 : 1,
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="" loading="lazy" className="h-full w-full object-cover" />
                  {isHighlight ? (
                    <span className="absolute left-2 top-2 rounded-full bg-accent px-2 py-0.5 text-[11px] font-medium text-neutral-0">
                      Highlight
                    </span>
                  ) : null}
                </div>
              );
            })}

            {/* The dragged stack — fanned thumbnails that follow the cursor */}
            <div
              className="absolute"
              style={{
                left: `${stackPos[0]}%`,
                top: `${stackPos[1]}%`,
                width: "19%",
                opacity: showStack ? (phase === "drop" ? 0 : 1) : 0,
                transform: `scale(${holding ? 1.04 : 1})`,
                transition: reduced
                  ? "none"
                  : `left 1.4s ${ease}, top 1.4s ${ease}, opacity .35s ease, transform .3s ${ease}`,
                zIndex: 5,
              }}
            >
              {photos.slice(0, 3).map((url, i) => (
                <div
                  key={i}
                  className="absolute overflow-hidden rounded-md border border-neutral-0 bg-well"
                  style={{
                    left: `${i * 7}%`,
                    top: `${i * -6}px`,
                    width: "100%",
                    aspectRatio: "3 / 4",
                    transform: `rotate(${(i - 1) * 4}deg)`,
                    boxShadow: holding
                      ? "0 12px 24px -6px rgba(16,24,40,0.35)"
                      : "0 2px 6px rgba(16,24,40,0.15)",
                    transition: `box-shadow .3s ease`,
                    zIndex: 3 - i,
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="" loading="lazy" className="h-full w-full object-cover" />
                </div>
              ))}
              {holding ? (
                <span className="absolute -right-2 -top-3 z-10 rounded-full bg-accent px-2 py-0.5 text-[11px] font-medium text-neutral-0 shadow-sm">
                  6
                </span>
              ) : null}
            </div>

            {/* The cursor */}
            <span
              className="pointer-events-none absolute"
              style={{
                left: `${cx}%`,
                top: `${cy}%`,
                opacity: reduced ? 0 : phase === "expand" ? 0 : 1,
                transition: reduced
                  ? "none"
                  : `left 1.2s ${ease}, top 1.2s ${ease}, opacity .4s ease`,
                zIndex: 10,
              }}
            >
              <CursorArrow pressed={holding || phase === "arranging"} />
            </span>
          </div>

          {/* Upload progress */}
          <div
            className="mt-4 h-1 w-full overflow-hidden rounded-full bg-well transition-opacity duration-500"
            style={{ opacity: phase === "uploading" ? 1 : 0 }}
            aria-hidden
          >
            <div
              className="h-1 rounded-full bg-accent"
              style={{
                width: phase === "uploading" ? "100%" : "0%",
                transition: reduced ? "none" : "width 1.6s linear",
              }}
            />
          </div>

          {/* Caption + the AI button the cursor presses */}
          <div className="mt-4 flex items-center justify-between gap-4">
            <p className="text-sm text-muted" aria-live="polite">
              {CAPTION[phase]}
            </p>
            <span
              className={`inline-flex shrink-0 items-center gap-2 rounded-md px-3.5 py-2 text-xs font-medium transition-all duration-300 ${
                phase === "arranging"
                  ? "scale-95 bg-accent-hover text-neutral-0"
                  : showArranged
                    ? "bg-accent-soft text-accent"
                    : "bg-accent text-neutral-0"
              }`}
              style={{ opacity: gridVisible ? 1 : 0.3 }}
            >
              <span aria-hidden className={phase === "arranging" ? "animate-pulse" : ""}>
                ✦
              </span>
              {showArranged ? "Undo" : "Arrange with AI"}
            </span>
          </div>
        </div>
      </div>
      <figcaption className="mt-3 text-center text-xs text-faint">
        Drag in a whole shoot, share it anywhere, and let the layout arrange
        itself — revert any time.
      </figcaption>
    </figure>
  );
}
