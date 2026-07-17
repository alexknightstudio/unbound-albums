/* eslint-disable @next/next/no-img-element */
"use client";

import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, useTransition } from "react";

import { SpreadRenderer } from "@/components/spreads/spread-renderer";
import {
  COVER_LAYOUT_STYLES,
  COVER_STYLE_LABELS,
  type AlbumCover,
  type CoverLayoutStyle,
} from "@/lib/albums/cover";
import { compatibleTemplates } from "@/lib/engine/editing";
import {
  TEMPLATES_BY_CODE,
  mirroredRect,
  type SlotCrop,
} from "@/lib/engine/templates";

import {
  changeSpreadTemplate,
  reorderSpreads,
  saveCover,
  saveSlotCrop,
  saveSpreadSlots,
  toggleSpreadFlip,
} from "./actions";

import type { ViewerSpread } from "@/components/album/album-viewer";
import type { AlbumSizeSpec } from "@/lib/albums/sizes";
import type { EnginePhoto } from "@/lib/engine/engine";

export type EditorPhoto = {
  id: string;
  url: string | null;
  orientation: "portrait" | "landscape" | "square";
  heroPotential: number;
  isCouplePortrait: boolean;
  setAsideReason: string | null;
};

type Selection =
  | { kind: "slot"; slotId: string }
  | { kind: "tray"; photoId: string }
  | null;

type CropDrag = {
  startX: number;
  startY: number;
  startCrop: SlotCrop;
  boxW: number;
  boxH: number;
  naturalW: number;
  naturalH: number;
};

/**
 * The editor. Tap-first: select a photo (white ring), tap where it should
 * go. Same interaction on a phone and a laptop — the milestone is a spread
 * rebuilt in under a minute on mobile, and taps beat drags there.
 */
export function AlbumEditor({
  albumId,
  sizeSpec,
  initialSpreads,
  photos,
  initialCover,
}: {
  albumId: string;
  sizeSpec: AlbumSizeSpec;
  initialSpreads: ViewerSpread[];
  photos: EditorPhoto[];
  initialCover: AlbumCover;
}) {
  const router = useRouter();
  const [spreads, setSpreads] = useState(initialSpreads);
  const [current, setCurrent] = useState(0);
  const [selection, setSelection] = useState<Selection>(null);
  const [tab, setTab] = useState<"pages" | "cover">("pages");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  // Reframing: which slot is in crop mode, its live crop, the photo's
  // natural dimensions (loaded async on mode entry), and the drag.
  const [cropSlotId, setCropSlotId] = useState<string | null>(null);
  const [liveCrop, setLiveCrop] = useState<SlotCrop | null>(null);
  const [cropNatural, setCropNatural] = useState<{ w: number; h: number } | null>(null);
  const cropDrag = useRef<CropDrag | null>(null);

  const spread = spreads[Math.min(current, spreads.length - 1)];
  const photosById = useMemo(
    () => new Map(photos.map((p) => [p.id, p])),
    [photos],
  );
  const photoUrlMap = useMemo(
    () =>
      new Map(
        photos.filter((p) => p.url).map((p) => [p.id, { url: p.url as string }]),
      ),
    [photos],
  );

  const placedIds = useMemo(
    () => new Set(spreads.flatMap((s) => Object.values(s.slots))),
    [spreads],
  );
  const trayPhotos = photos.filter((p) => !placedIds.has(p.id));

  function fail(message: string) {
    setError(message);
    router.refresh();
  }

  function commitSlots(next: Record<string, string>) {
    const previous = spread.slots;
    const previousCrops = spread.slot_crops;
    // Mirror the server's rule locally: a slot whose photo changed loses
    // its crop.
    const nextCrops: Record<string, SlotCrop> = {};
    for (const [slotId, crop] of Object.entries(previousCrops ?? {})) {
      if (next[slotId] === previous[slotId]) nextCrops[slotId] = crop;
    }
    setError(null);
    setSpreads((all) =>
      all.map((s) =>
        s.id === spread.id ? { ...s, slots: next, slot_crops: nextCrops } : s,
      ),
    );
    setSelection(null);
    startTransition(async () => {
      const result = await saveSpreadSlots(spread.id, next);
      if (!result.ok) {
        setSpreads((all) =>
          all.map((s) =>
            s.id === spread.id
              ? { ...s, slots: previous, slot_crops: previousCrops }
              : s,
          ),
        );
        fail(result.error ?? "Could not save.");
      }
    });
  }

  function enterCropMode(slotId: string) {
    setCropSlotId(slotId);
    setLiveCrop(spread.slot_crops?.[slotId] ?? { x: 50, y: 50 });
    setSelection(null);
    // The photo's natural size arrives async; drags before onload no-op.
    setCropNatural(null);
    const photoId = spread.slots[slotId];
    const photo = photoId ? photosById.get(photoId) : undefined;
    if (photo?.url) {
      const img = new Image();
      img.onload = () =>
        setCropNatural({ w: img.naturalWidth, h: img.naturalHeight });
      img.src = photo.url;
    }
  }

  function exitCropMode() {
    setCropSlotId(null);
    setLiveCrop(null);
    setCropNatural(null);
    cropDrag.current = null;
  }

  function onCropPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (!cropSlotId || !liveCrop || !cropNatural) return;
    const box = event.currentTarget.getBoundingClientRect();
    cropDrag.current = {
      startX: event.clientX,
      startY: event.clientY,
      startCrop: liveCrop,
      boxW: box.width,
      boxH: box.height,
      naturalW: cropNatural.w,
      naturalH: cropNatural.h,
    };
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Capture is an enhancement (keeps the drag when the pointer leaves
      // the slot). Some environments reject the pointer id; drag still works.
    }
  }

  function onCropPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const drag = cropDrag.current;
    if (!drag || drag.naturalW === 0 || drag.naturalH === 0) return;
    // object-fit: cover overflows on exactly one axis; dragging pans it.
    const scale = Math.max(
      drag.boxW / drag.naturalW,
      drag.boxH / drag.naturalH,
    );
    const overflowX = drag.naturalW * scale - drag.boxW;
    const overflowY = drag.naturalH * scale - drag.boxH;
    const clamp = (n: number) => Math.max(0, Math.min(100, n));
    setLiveCrop({
      x:
        overflowX > 1
          ? clamp(
              drag.startCrop.x -
                ((event.clientX - drag.startX) / overflowX) * 100,
            )
          : drag.startCrop.x,
      y:
        overflowY > 1
          ? clamp(
              drag.startCrop.y -
                ((event.clientY - drag.startY) / overflowY) * 100,
            )
          : drag.startCrop.y,
    });
  }

  function onCropPointerUp() {
    if (!cropDrag.current || !cropSlotId || !liveCrop) return;
    cropDrag.current = null;
    const slotId = cropSlotId;
    const crop = liveCrop;
    // Persist on release; the mode stays open for further nudging.
    setSpreads((all) =>
      all.map((s) =>
        s.id === spread.id
          ? { ...s, slot_crops: { ...(s.slot_crops ?? {}), [slotId]: crop } }
          : s,
      ),
    );
    startTransition(async () => {
      const result = await saveSlotCrop(spread.id, slotId, crop);
      if (!result.ok) fail(result.error ?? "Could not save.");
    });
  }

  function onFlip() {
    const previous = spread.flipped;
    setError(null);
    setSelection(null);
    exitCropMode();
    setSpreads((all) =>
      all.map((s) => (s.id === spread.id ? { ...s, flipped: !previous } : s)),
    );
    startTransition(async () => {
      const result = await toggleSpreadFlip(spread.id);
      if (!result.ok) {
        setSpreads((all) =>
          all.map((s) =>
            s.id === spread.id ? { ...s, flipped: previous } : s,
          ),
        );
        fail(result.error ?? "Could not save.");
      }
    });
  }

  function onSlotTap(slotId: string) {
    if (pending) return;
    const occupant = spread.slots[slotId];

    if (!selection) {
      if (occupant) setSelection({ kind: "slot", slotId });
      return;
    }

    if (selection.kind === "slot") {
      if (selection.slotId === slotId) {
        setSelection(null);
        return;
      }
      // Swap the two slots' photos (either may be empty).
      const next = { ...spread.slots };
      const a = next[selection.slotId];
      const b = next[slotId];
      delete next[selection.slotId];
      delete next[slotId];
      if (b) next[selection.slotId] = b;
      if (a) next[slotId] = a;
      commitSlots(next);
      return;
    }

    // Tray photo → this slot (replacing whatever was there).
    const next = { ...spread.slots, [slotId]: selection.photoId };
    commitSlots(next);
  }

  function onRemoveSelected() {
    if (!selection || selection.kind !== "slot") return;
    const next = { ...spread.slots };
    delete next[selection.slotId];
    commitSlots(next);
  }

  function onTemplateChange(code: string) {
    setError(null);
    setSelection(null);
    startTransition(async () => {
      const result = await changeSpreadTemplate(spread.id, code);
      if (!result.ok) fail(result.error ?? "Could not save.");
      else router.refresh();
    });
  }

  function onMoveSpread(direction: -1 | 1) {
    const target = current + direction;
    if (target < 0 || target >= spreads.length) return;
    const next = [...spreads];
    [next[current], next[target]] = [next[target], next[current]];
    setSpreads(next);
    setCurrent(target);
    setError(null);
    startTransition(async () => {
      const result = await reorderSpreads(
        albumId,
        next.map((s) => s.id),
      );
      if (!result.ok) {
        setSpreads(spreads);
        setCurrent(current);
        fail(result.error ?? "Could not reorder.");
      }
    });
  }

  async function onRegenerate() {
    setError(null);
    setSelection(null);
    const response = await fetch(`/api/spreads/${spread.id}/regenerate`, {
      method: "POST",
    });
    const body = await response.json().catch(() => null);
    if (!response.ok) {
      setError(body?.error ?? "The redesign hit a snag. Try again.");
      return;
    }
    // Full reload: the redesigned spread arrives as fresh server props.
    window.location.reload();
  }

  const template = TEMPLATES_BY_CODE.get(spread?.template_code ?? "");
  const spreadEnginePhotos: EnginePhoto[] = spread
    ? Object.values(spread.slots)
        .map((id) => photosById.get(id))
        .filter((p): p is EditorPhoto => Boolean(p))
        .map((p) => ({ id: p.id, orientation: p.orientation }))
    : [];
  const templateOptions = spread
    ? compatibleTemplates(spreadEnginePhotos).filter(
        (t) => t.code !== spread.template_code,
      )
    : [];

  return (
    <div className="flex flex-col gap-6">
      {/* Tabs */}
      <div className="flex gap-2">
        {(["pages", "cover"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`rounded-md px-4 py-2 text-sm transition-colors ${
              tab === t
                ? "bg-parchment text-ink"
                : "border border-stone text-pewter hover:text-parchment"
            }`}
          >
            {t === "pages" ? "Pages" : "Cover"}
          </button>
        ))}
      </div>

      {error ? (
        <p role="alert" className="text-xs text-pewter">
          {error}
        </p>
      ) : null}

      {tab === "cover" ? (
        <CoverDesigner
          albumId={albumId}
          photos={photos}
          sizeSpec={sizeSpec}
          initialCover={initialCover}
        />
      ) : spread ? (
        <>
          {/* The spread, with tappable slots overlaid on the render */}
          <div className="relative">
            <SpreadRenderer
              templateCode={spread.template_code}
              slots={spread.slots}
              photosById={photoUrlMap}
              sizeSpec={sizeSpec}
              crops={
                cropSlotId && liveCrop
                  ? { ...(spread.slot_crops ?? {}), [cropSlotId]: liveCrop }
                  : spread.slot_crops
              }
              flipped={spread.flipped}
              showFold
            />
            {template
              ? template.slots.map((slot) => {
                  const rect = spread.flipped
                    ? mirroredRect(slot.rect)
                    : slot.rect;
                  const style = {
                    left: `${rect.x * 100}%`,
                    top: `${rect.y * 100}%`,
                    width: `${rect.w * 100}%`,
                    height: `${rect.h * 100}%`,
                  };
                  if (cropSlotId === slot.id) {
                    // Crop mode: this slot becomes a drag surface.
                    return (
                      <div
                        key={slot.id}
                        role="slider"
                        aria-label={`Reframe ${slot.id}`}
                        aria-valuenow={liveCrop ? Math.round(liveCrop.x) : 50}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuetext={
                          liveCrop ? `${Math.round(liveCrop.x)}%, ${Math.round(liveCrop.y)}%` : undefined
                        }
                        onPointerDown={onCropPointerDown}
                        onPointerMove={onCropPointerMove}
                        onPointerUp={onCropPointerUp}
                        className="absolute cursor-move ring-2 ring-white"
                        style={{ ...style, touchAction: "none" }}
                      />
                    );
                  }
                  const isSelected =
                    selection?.kind === "slot" && selection.slotId === slot.id;
                  return (
                    <button
                      key={slot.id}
                      type="button"
                      onClick={() => {
                        if (cropSlotId) return; // one thing at a time
                        onSlotTap(slot.id);
                      }}
                      aria-label={`Slot ${slot.id}`}
                      className={`absolute transition-shadow ${
                        isSelected
                          ? "ring-2 ring-white ring-offset-0"
                          : "hover:ring-1 hover:ring-white/50"
                      }`}
                      style={style}
                    />
                  );
                })
              : null}
          </div>

          {cropSlotId ? (
            <div className="flex items-center justify-between gap-3 rounded-md border border-stone px-4 py-3">
              <span className="text-xs text-pewter">
                Drag the photo to reframe it. It saves as you go.
              </span>
              <button
                type="button"
                onClick={exitCropMode}
                className="rounded-md bg-parchment px-4 py-1.5 text-xs text-ink"
              >
                Done
              </button>
            </div>
          ) : null}

          {/* Spread controls */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setSelection(null);
                  setCurrent(Math.max(0, current - 1));
                }}
                disabled={current === 0}
                className="rounded-md border border-stone px-3 py-2 text-sm text-pewter disabled:opacity-30"
              >
                ←
              </button>
              <span className="text-xs tracking-widest text-slate">
                SPREAD {current + 1} OF {spreads.length}
              </span>
              <button
                type="button"
                onClick={() => {
                  setSelection(null);
                  setCurrent(Math.min(spreads.length - 1, current + 1));
                }}
                disabled={current === spreads.length - 1}
                className="rounded-md border border-stone px-3 py-2 text-sm text-pewter disabled:opacity-30"
              >
                →
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onMoveSpread(-1)}
                disabled={current === 0 || pending}
                className="rounded-md border border-stone px-3 py-2 text-xs text-pewter disabled:opacity-30"
              >
                Move earlier
              </button>
              <button
                type="button"
                onClick={() => onMoveSpread(1)}
                disabled={current === spreads.length - 1 || pending}
                className="rounded-md border border-stone px-3 py-2 text-xs text-pewter disabled:opacity-30"
              >
                Move later
              </button>
              <button
                type="button"
                onClick={onFlip}
                disabled={pending}
                className="rounded-md border border-stone px-3 py-2 text-xs text-pewter transition-colors hover:border-pewter hover:text-parchment disabled:opacity-30"
              >
                Flip spread
              </button>
              <button
                type="button"
                onClick={() => void onRegenerate()}
                disabled={pending}
                className="rounded-md border border-stone px-3 py-2 text-xs text-pewter transition-colors hover:border-pewter hover:text-parchment disabled:opacity-30"
              >
                Redesign this spread
              </button>
            </div>
          </div>

          {selection?.kind === "slot" && !cropSlotId ? (
            <div className="flex flex-wrap items-center gap-3 rounded-md border border-stone px-4 py-3">
              <span className="text-xs text-pewter">
                Photo selected. Tap another slot to swap, a tray photo to
                replace it, or
              </span>
              <button
                type="button"
                onClick={() => enterCropMode(selection.slotId)}
                className="rounded-md border border-stone px-3 py-1.5 text-xs text-pewter hover:border-pewter hover:text-parchment"
              >
                Reframe it
              </button>
              <button
                type="button"
                onClick={onRemoveSelected}
                className="rounded-md border border-stone px-3 py-1.5 text-xs text-pewter hover:border-pewter hover:text-parchment"
              >
                Remove it
              </button>
            </div>
          ) : null}

          {/* Template picker */}
          {templateOptions.length > 0 ? (
            <div className="flex flex-col gap-2">
              <h3 className="text-xs tracking-widest text-slate">
                OTHER LAYOUTS FOR THESE PHOTOS
              </h3>
              <div className="scrollbar-none flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
                {templateOptions.map((t) => (
                  <button
                    key={t.code}
                    type="button"
                    disabled={pending}
                    onClick={() => onTemplateChange(t.code)}
                    className="w-28 shrink-0 overflow-hidden rounded-sm border border-stone opacity-70 transition-opacity hover:opacity-100 disabled:opacity-30"
                    aria-label={`Switch to layout ${t.code}`}
                  >
                    <div
                      className="relative w-full bg-white"
                      style={{
                        aspectRatio: `${(sizeSpec.pageWidthIn * 2) / sizeSpec.pageHeightIn}`,
                      }}
                    >
                      {t.slots.map((slot) => (
                        <div
                          key={slot.id}
                          className="absolute bg-pewter/60"
                          style={{
                            left: `${slot.rect.x * 100}%`,
                            top: `${slot.rect.y * 100}%`,
                            width: `${slot.rect.w * 100}%`,
                            height: `${slot.rect.h * 100}%`,
                          }}
                        />
                      ))}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {/* Tray */}
          <div className="flex flex-col gap-2">
            <h3 className="text-xs tracking-widest text-slate">
              NOT IN THE ALBUM ({trayPhotos.length})
            </h3>
            {trayPhotos.length === 0 ? (
              <p className="text-xs text-slate">
                Every photo has a page. Remove one to free it up.
              </p>
            ) : (
              <div className="scrollbar-none flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
                {trayPhotos.map((photo) => {
                  const isSelected =
                    selection?.kind === "tray" && selection.photoId === photo.id;
                  return (
                    <button
                      key={photo.id}
                      type="button"
                      onClick={() =>
                        setSelection(isSelected ? null : { kind: "tray", photoId: photo.id })
                      }
                      className={`relative h-20 w-20 shrink-0 overflow-hidden rounded-sm border transition-colors ${
                        isSelected ? "border-white" : "border-stone"
                      }`}
                      aria-label="Tray photo"
                    >
                      {photo.url ? (
                        <img
                          src={photo.url}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="h-full w-full bg-stone" />
                      )}
                      {photo.setAsideReason ? (
                        <span
                          title={photo.setAsideReason}
                          className="absolute bottom-1 right-1 rounded-sm bg-ink/70 px-1 text-[9px] text-pewter"
                        >
                          set aside
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            )}
            {selection?.kind === "tray" ? (
              <p className="text-xs text-pewter">
                Now tap the slot where this photo belongs.
              </p>
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  );
}

/* ----------------------------------------------------------------------- */

function CoverDesigner({
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
  const router = useRouter();
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
      else {
        setSaved(true);
        router.refresh();
      }
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
