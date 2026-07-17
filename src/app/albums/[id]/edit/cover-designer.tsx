/* eslint-disable @next/next/no-img-element */
"use client";

import { useMemo, useState, useTransition } from "react";

import {
  COVER_LAYOUT_STYLES,
  COVER_STYLE_LABELS,
  type AlbumCover,
  type CoverLayoutStyle,
} from "@/lib/albums/cover";

import { saveCover } from "./actions";

import type { AlbumSizeSpec } from "@/lib/albums/sizes";
import type { EditorPhoto } from "./album-editor";

export function CoverDesigner({
  albumId,
  photos,
  sizeSpec,
  initialCover,
}: {
  albumId: string;
  photos: EditorPhoto[];
  sizeSpec: AlbumSizeSpec;
  initialCover: AlbumCover;
}) {
  const [cover, setCover] = useState<AlbumCover>(initialCover);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // AI-ranked hero candidates: couple portraits first, by hero potential.
  const candidates = useMemo(() => {
    const ranked = [...photos]
      .filter((p) => p.url)
      .sort(
        (a, b) =>
          Number(b.isCouplePortrait) - Number(a.isCouplePortrait) ||
          b.heroPotential - a.heroPotential,
      );
    return ranked.slice(0, 9);
  }, [photos]);

  const hero = photos.find((p) => p.id === cover.hero_photo_id) ?? null;

  function onSave() {
    if (!cover.hero_photo_id) {
      setError("Pick a cover photo.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await saveCover(albumId, {
        hero_photo_id: cover.hero_photo_id as string,
        title_text: cover.title_text,
        subtitle_text: cover.subtitle_text,
        layout_style: cover.layout_style,
      });
      if (!result.ok) setError(result.error ?? "Could not save.");
      else setSaved(true);
    });
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Live preview — the front cover as a book */}
      <div className="flex justify-center">
        <div
          className="relative w-full max-w-sm overflow-hidden rounded-r-sm bg-charcoal shadow-[0_1px_40px_rgba(0,0,0,0.55)]"
          style={{
            aspectRatio: `${sizeSpec.pageWidthIn / sizeSpec.pageHeightIn}`,
          }}
        >
          {hero?.url ? (
            <img
              src={hero.url}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 bg-stone" />
          )}
          {/* Spine */}
          <div className="absolute inset-y-0 left-0 w-[4%] bg-gradient-to-r from-ink/60 to-transparent" />

          {cover.layout_style === "centered" ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 px-6 text-center">
              <p className="font-display text-3xl font-light text-white [text-shadow:0_1px_18px_rgba(0,0,0,0.7)]">
                {cover.title_text || "Your names"}
              </p>
              {cover.subtitle_text ? (
                <p className="text-xs tracking-widest text-white/85 [text-shadow:0_1px_12px_rgba(0,0,0,0.7)]">
                  {cover.subtitle_text}
                </p>
              ) : null}
            </div>
          ) : null}
          {cover.layout_style === "bottom_left" ? (
            <div className="absolute bottom-6 left-[10%] flex flex-col gap-1">
              <p className="font-display text-2xl font-light text-white [text-shadow:0_1px_18px_rgba(0,0,0,0.7)]">
                {cover.title_text || "Your names"}
              </p>
              {cover.subtitle_text ? (
                <p className="text-[11px] tracking-widest text-white/85 [text-shadow:0_1px_12px_rgba(0,0,0,0.7)]">
                  {cover.subtitle_text}
                </p>
              ) : null}
            </div>
          ) : null}
          {cover.layout_style === "minimal" ? (
            <div className="absolute inset-x-0 bottom-4 text-center">
              <p className="text-[11px] tracking-[0.3em] text-white/90 [text-shadow:0_1px_12px_rgba(0,0,0,0.7)]">
                {(cover.title_text || "YOUR NAMES").toUpperCase()}
              </p>
            </div>
          ) : null}
        </div>
      </div>

      {/* Style */}
      <div className="flex gap-2">
        {COVER_LAYOUT_STYLES.map((style: CoverLayoutStyle) => (
          <button
            key={style}
            type="button"
            onClick={() => setCover((c) => ({ ...c, layout_style: style }))}
            className={`rounded-md px-4 py-2 text-xs transition-colors ${
              cover.layout_style === style
                ? "bg-parchment text-ink"
                : "border border-stone text-pewter hover:text-parchment"
            }`}
          >
            {COVER_STYLE_LABELS[style]}
          </button>
        ))}
      </div>

      {/* Text */}
      <div className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-xs text-pewter">
          Title
          <input
            type="text"
            value={cover.title_text}
            maxLength={80}
            onChange={(e) =>
              setCover((c) => ({ ...c, title_text: e.target.value }))
            }
            placeholder="Alex & Laura"
            className="rounded-md border border-stone bg-charcoal px-3 py-2 text-sm text-parchment placeholder:text-slate focus:border-pewter focus:outline-none"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-pewter">
          Subtitle
          <input
            type="text"
            value={cover.subtitle_text}
            maxLength={120}
            onChange={(e) =>
              setCover((c) => ({ ...c, subtitle_text: e.target.value }))
            }
            placeholder="June 12, 2026 · New York"
            className="rounded-md border border-stone bg-charcoal px-3 py-2 text-sm text-parchment placeholder:text-slate focus:border-pewter focus:outline-none"
          />
        </label>
      </div>

      {/* Hero picker */}
      <div className="flex flex-col gap-2">
        <h3 className="text-xs tracking-widest text-slate">
          THE COVER PHOTO — OUR PICKS FIRST
        </h3>
        <div className="grid grid-cols-3 gap-2">
          {candidates.map((photo) => (
            <button
              key={photo.id}
              type="button"
              onClick={() =>
                setCover((c) => ({ ...c, hero_photo_id: photo.id }))
              }
              className={`overflow-hidden rounded-sm border transition-colors ${
                cover.hero_photo_id === photo.id
                  ? "border-white"
                  : "border-stone opacity-80 hover:opacity-100"
              }`}
              aria-label="Cover candidate"
            >
              <img
                src={photo.url as string}
                alt=""
                className="aspect-square h-auto w-full object-cover"
              />
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onSave}
          disabled={pending}
          className="rounded-md bg-parchment px-6 py-3 text-sm text-ink transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          Save cover
        </button>
        {saved && !error ? (
          <span className="text-xs text-pewter">Saved.</span>
        ) : null}
        {error ? (
          <span role="alert" className="text-xs text-pewter">
            {error}
          </span>
        ) : null}
      </div>
    </div>
  );
}
