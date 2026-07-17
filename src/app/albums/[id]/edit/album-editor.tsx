/* eslint-disable @next/next/no-img-element */
"use client";

import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";

import { SpreadRenderer } from "@/components/spreads/spread-renderer";
import { assignPhotosToTemplate, cycleTemplate } from "@/lib/engine/editing";
import {
  TEMPLATES_BY_CODE,
  mirroredRect,
  slotAcceptsPhoto,
  type SlotAccepts,
  type SlotCrop,
} from "@/lib/engine/templates";

import type { RegenIntent } from "@/lib/ai/prompts/layout";

import { reorderSpreads, restoreSpreadState } from "./actions";
import { CoverDesigner } from "./cover-designer";
import { Filmstrip, StoryView } from "./filmstrip";
import { PhotoTray } from "./photo-tray";
import { TemplateRail } from "./template-rail";

import type { ViewerSpread } from "@/components/album/album-viewer";
import type { AlbumCover } from "@/lib/albums/cover";
import type { AlbumSizeSpec } from "@/lib/albums/sizes";
import type { EnginePhoto } from "@/lib/engine/engine";

export type EditorPhoto = {
  id: string;
  url: string | null;
  orientation: "portrait" | "landscape" | "square";
  heroPotential: number;
  isCouplePortrait: boolean;
  setAsideReason: string | null;
  /** Wedding-day stage from the AI analysis ("ceremony", "portraits", ...). */
  stage: string;
  emotion: string;
};

/** Everything that defines one spread's design — the undo/redo unit. */
type Snapshot = {
  template_code: string;
  slots: Record<string, string>;
  slot_crops: Record<string, SlotCrop>;
  flipped: boolean;
};

type HistoryOp =
  | { kind: "spread"; spreadId: string; before: Snapshot; after: Snapshot }
  | { kind: "order"; before: string[]; after: string[] };

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
  /** Updated per pointermove WITHOUT setState — the img's objectPosition is
   * mutated directly so a 120Hz drag never re-renders the whole workspace. */
  live: SlotCrop;
};

const HISTORY_LIMIT = 50;

function snapshotOf(spread: ViewerSpread): Snapshot {
  return {
    template_code: spread.template_code,
    slots: { ...spread.slots },
    slot_crops: { ...(spread.slot_crops ?? {}) },
    flipped: spread.flipped,
  };
}

/**
 * The editor workspace. Four regions on desktop — template rail, canvas,
 * photo tray, filmstrip — the same components rehoused vertically on
 * mobile. Every mutation flows through one snapshot-based pipeline, which
 * is what makes global undo/redo possible.
 */
export function AlbumEditor({
  albumId,
  albumTitle,
  sizeSpec,
  initialSpreads,
  photos,
  initialCover,
}: {
  albumId: string;
  albumTitle: string;
  sizeSpec: AlbumSizeSpec;
  initialSpreads: ViewerSpread[];
  photos: EditorPhoto[];
  initialCover: AlbumCover;
}) {
  const [spreads, setSpreads] = useState(initialSpreads);
  const [current, setCurrent] = useState(0);
  const [selection, setSelection] = useState<Selection>(null);
  const [tab, setTab] = useState<"pages" | "cover">("pages");
  const [storyOpen, setStoryOpen] = useState(false);
  const [warningsOpen, setWarningsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** The AI's one-line rationale after a redesign — shown, then cleared. */
  const [notice, setNotice] = useState<string | null>(null);
  const [redesignMenuOpen, setRedesignMenuOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [regenBusy, setRegenBusy] = useState(false);

  const [undoStack, setUndoStack] = useState<HistoryOp[]>([]);
  const [redoStack, setRedoStack] = useState<HistoryOp[]>([]);

  // Reframing state.
  const [cropSlotId, setCropSlotId] = useState<string | null>(null);
  const [liveCrop, setLiveCrop] = useState<SlotCrop | null>(null);
  const [cropNatural, setCropNatural] = useState<{ w: number; h: number } | null>(null);
  const cropDrag = useRef<CropDrag | null>(null);
  const cropSession = useRef(0);
  const canvasRef = useRef<HTMLDivElement | null>(null);

  const [draggingPhotoId, setDraggingPhotoId] = useState<string | null>(null);
  // First-run hint; localStorage read happens after mount (no SSR value).
  const [coach, setCoach] = useState(false);
  useEffect(() => {
    // Deferred a tick: reading localStorage is fine, but setting state
    // synchronously inside an effect trips the cascading-render lint.
    const timer = setTimeout(() => {
      if (!window.localStorage.getItem("unbound-editor-coach-done")) {
        setCoach(true);
      }
    }, 0);
    return () => clearTimeout(timer);
  }, []);
  function dismissCoach() {
    window.localStorage.setItem("unbound-editor-coach-done", "1");
    setCoach(false);
  }

  const spread = spreads[Math.min(current, spreads.length - 1)];
  const template = TEMPLATES_BY_CODE.get(spread?.template_code ?? "");

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

  /** Photos on the current spread, emphasis slot first — the order the
   * template rail re-flows them in, so the strongest photo stays lead. */
  const spreadPhotos: EnginePhoto[] = useMemo(() => {
    if (!spread || !template) return [];
    const ordered = [...template.slots].sort(
      (a, b) => Number(b.emphasis ?? false) - Number(a.emphasis ?? false),
    );
    return ordered
      .map((slot) => spread.slots[slot.id])
      .filter((id): id is string => Boolean(id))
      .map((id) => photosById.get(id))
      .filter((p): p is EditorPhoto => Boolean(p))
      .map((p) => ({ id: p.id, orientation: p.orientation }));
  }, [spread, template, photosById]);

  const warnings = useMemo(() => {
    const list: Array<{ spreadIndex: number; message: string }> = [];
    spreads.forEach((s, i) => {
      const t = TEMPLATES_BY_CODE.get(s.template_code);
      if (!t) return;
      const empty = t.slots.length - Object.keys(s.slots).length;
      if (empty > 0) {
        list.push({
          spreadIndex: i,
          message: `Spread ${i + 1} has ${empty} empty ${empty === 1 ? "slot" : "slots"}.`,
        });
      }
    });
    return list;
  }, [spreads]);

  /** Same-moment swaps for the selected slot's photo: unplaced, same stage,
   * fits the slot, strongest first. */
  const alternatives: EditorPhoto[] = useMemo(() => {
    if (selection?.kind !== "slot" || !template) return [];
    const photoId = spread?.slots[selection.slotId];
    const slotDef = template.slots.find((s) => s.id === selection.slotId);
    if (!photoId || !slotDef) return [];
    const anchor = photosById.get(photoId);
    if (!anchor) return [];
    return photos
      .filter(
        (p) =>
          p.id !== photoId &&
          p.url &&
          !placedIds.has(p.id) &&
          p.stage === anchor.stage &&
          slotAcceptsPhoto(slotDef.accepts, p.orientation),
      )
      .sort((a, b) => b.heroPotential - a.heroPotential)
      .slice(0, 6);
  }, [selection, template, spread, photos, photosById, placedIds]);

  /** Dominant wedding stage per spread — the story view's chapter dividers. */
  const spreadStages: string[] = useMemo(
    () =>
      spreads.map((s) => {
        const counts = new Map<string, number>();
        for (const pid of Object.values(s.slots)) {
          const stage = photosById.get(pid)?.stage ?? "other";
          counts.set(stage, (counts.get(stage) ?? 0) + 1);
        }
        let best = "other";
        let bestN = 0;
        for (const [stage, n] of counts) {
          if (n > bestN) [best, bestN] = [stage, n];
        }
        return best;
      }),
    [spreads, photosById],
  );

  const busy = pending || regenBusy;

  // A crop session and a selection belong to ONE spread and ONE tab. Any
  // navigation ends them — otherwise a pointer-up could write the previous
  // spread's crop into the current spread's same-named slot.
  const navKey = `${tab}:${spread?.id ?? ""}`;
  const lastNavKey = useRef(navKey);
  useEffect(() => {
    if (lastNavKey.current !== navKey) {
      lastNavKey.current = navKey;
      setSelection(null);
      setCropSlotId(null);
      setLiveCrop(null);
      setCropNatural(null);
      cropDrag.current = null;
    }
  }, [navKey]);

  /* ------------------------------------------------------------------ */
  /* The one mutation pipeline: apply a spread snapshot, record history. */
  /* ------------------------------------------------------------------ */

  function applySpread(spreadId: string, after: Snapshot, record: boolean) {
      const target = spreads.find((s) => s.id === spreadId);
      if (!target) return;
      const before = snapshotOf(target);
      setError(null);
      setNotice(null);
      setSpreads((all) =>
        all.map((s) => (s.id === spreadId ? { ...s, ...after } : s)),
      );
      if (record) {
        setUndoStack((stack) =>
          [...stack, { kind: "spread" as const, spreadId, before, after }].slice(
            -HISTORY_LIMIT,
          ),
        );
        setRedoStack([]);
      }
      startTransition(async () => {
        const result = await restoreSpreadState(spreadId, after);
        if (!result.ok) {
          setSpreads((all) =>
            all.map((s) => (s.id === spreadId ? { ...s, ...before } : s)),
          );
          if (record) setUndoStack((stack) => stack.slice(0, -1));
          setError(result.error ?? "Could not save.");
        }
      });
  }

  function applyOrder(orderedIds: string[], record: boolean) {
      const before = spreads.map((s) => s.id);
      if (
        before.length === orderedIds.length &&
        before.every((id, i) => id === orderedIds[i])
      ) {
        return;
      }
      const currentId = spread?.id;
      const byId = new Map(spreads.map((s) => [s.id, s]));
      const next = orderedIds
        .map((id) => byId.get(id))
        .filter((s): s is ViewerSpread => Boolean(s));
      setError(null);
      setSpreads(next);
      if (currentId) {
        const idx = next.findIndex((s) => s.id === currentId);
        if (idx !== -1) setCurrent(idx);
      }
      if (record) {
        setUndoStack((stack) =>
          [...stack, { kind: "order" as const, before, after: orderedIds }].slice(
            -HISTORY_LIMIT,
          ),
        );
        setRedoStack([]);
      }
      startTransition(async () => {
        const result = await reorderSpreads(albumId, orderedIds);
        if (!result.ok) {
          const restore = before
            .map((id) => byId.get(id))
            .filter((s): s is ViewerSpread => Boolean(s));
          setSpreads(restore);
          if (record) setUndoStack((stack) => stack.slice(0, -1));
          setError(result.error ?? "Could not reorder.");
        }
      });
  }

  function applyOp(op: HistoryOp, direction: "undo" | "redo") {
    const state = direction === "undo" ? "before" : "after";
    if (op.kind === "spread") applySpread(op.spreadId, op[state], false);
    else applyOrder(op[state], false);
  }

  function undo() {
    if (busy) return;
    // Read the stack directly — never run side effects inside a state
    // updater (React double-invokes updaters in dev, corrupting the stack).
    const op = undoStack[undoStack.length - 1];
    if (!op) return;
    setUndoStack(undoStack.slice(0, -1));
    setRedoStack([...redoStack, op]);
    applyOp(op, "undo");
  }

  function redo() {
    if (busy) return;
    const op = redoStack[redoStack.length - 1];
    if (!op) return;
    setRedoStack(redoStack.slice(0, -1));
    setUndoStack([...undoStack, op]);
    applyOp(op, "redo");
  }

  /* ------------------------------------------------------------------ */
  /* Editing gestures — all expressed as snapshots.                     */
  /* ------------------------------------------------------------------ */

  function nextSnapshotWithSlots(slots: Record<string, string>): Snapshot {
    // A slot whose photo changed loses its crop (server enforces the same).
    const crops: Record<string, SlotCrop> = {};
    for (const [slotId, crop] of Object.entries(spread.slot_crops ?? {})) {
      if (slots[slotId] === spread.slots[slotId]) crops[slotId] = crop;
    }
    return {
      template_code: spread.template_code,
      slots,
      slot_crops: crops,
      flipped: spread.flipped,
    };
  }

  function placePhoto(slotId: string, photoId: string) {
    const next = { ...spread.slots };
    // If the photo already sits on this spread, treat as a move.
    for (const [sid, pid] of Object.entries(next)) {
      if (pid === photoId) delete next[sid];
    }
    next[slotId] = photoId;
    applySpread(spread.id, nextSnapshotWithSlots(next), true);
    setSelection(null);
  }

  function swapSlots(a: string, b: string) {
    const next = { ...spread.slots };
    const pa = next[a];
    const pb = next[b];
    delete next[a];
    delete next[b];
    if (pb) next[a] = pb;
    if (pa) next[b] = pa;
    applySpread(spread.id, nextSnapshotWithSlots(next), true);
    setSelection(null);
  }

  function removeFromSlot(slotId: string) {
    const next = { ...spread.slots };
    delete next[slotId];
    applySpread(spread.id, nextSnapshotWithSlots(next), true);
    setSelection(null);
  }

  function applyTemplate(code: string, assignment: Record<string, string>) {
    applySpread(
      spread.id,
      {
        template_code: code,
        slots: assignment,
        slot_crops: {}, // new geometry, fresh framing
        flipped: spread.flipped,
      },
      true,
    );
    setSelection(null);
  }

  function cycle(direction: 1 | -1) {
    if (!spread || spreadPhotos.length === 0 || busy) return;
    const next = cycleTemplate(spread.template_code, spreadPhotos, direction);
    if (!next) return;
    const assignment = assignPhotosToTemplate(next, spreadPhotos);
    if (assignment) applyTemplate(next.code, assignment);
  }

  function flipSpread() {
    applySpread(
      spread.id,
      { ...snapshotOf(spread), flipped: !spread.flipped },
      true,
    );
  }

  async function redesignSpread(
    intent: RegenIntent = "surprise",
    heroPhotoId?: string,
  ) {
    setError(null);
    setNotice(null);
    setRedesignMenuOpen(false);
    setSelection(null);
    setRegenBusy(true);
    try {
      const before = snapshotOf(spread);
      const spreadId = spread.id;
      let response: Response;
      try {
        response = await fetch(`/api/spreads/${spreadId}/regenerate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ intent, heroPhotoId }),
        });
      } catch {
        setError("Connection lost. Nothing changed.");
        return;
      }
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        setError(body?.error ?? "The redesign hit a snag. Try again.");
        return;
      }
      const after: Snapshot = {
        template_code: body.template_code,
        slots: body.slots ?? {},
        slot_crops: {},
        flipped: false,
      };
      setSpreads((all) =>
        all.map((s) =>
          s.id === spreadId
            ? { ...s, ...after, regen_count: body.regen_count }
            : s,
        ),
      );
      setUndoStack((stack) =>
        [...stack, { kind: "spread" as const, spreadId, before, after }].slice(
          -HISTORY_LIMIT,
        ),
      );
      setRedoStack([]);
      if (typeof body.note === "string" && body.note) setNotice(body.note);
    } finally {
      setRegenBusy(false);
    }
  }

  /* ------------------------------------------------------------------ */
  /* Slot interactions (tap + drop).                                    */
  /* ------------------------------------------------------------------ */

  function onSlotTap(slotId: string) {
    if (busy || cropSlotId) return;

    if (!selection) {
      // Empty slots are selectable too — they're exactly what the warnings
      // ask couples to fill.
      setSelection({ kind: "slot", slotId });
      return;
    }
    if (selection.kind === "slot") {
      if (selection.slotId === slotId) {
        setSelection(null);
        return;
      }
      swapSlots(selection.slotId, slotId);
      return;
    }
    placePhoto(slotId, selection.photoId);
  }

  function onTraySelect(photoId: string) {
    if (busy || placedIds.has(photoId)) return;
    if (selection?.kind === "slot") {
      placePhoto(selection.slotId, photoId);
      return;
    }
    setSelection(
      selection?.kind === "tray" && selection.photoId === photoId
        ? null
        : { kind: "tray", photoId },
    );
  }

  /* ------------------------------------------------------------------ */
  /* Crop mode (pan within slot).                                       */
  /* ------------------------------------------------------------------ */

  function enterCropMode(slotId: string) {
    setCropSlotId(slotId);
    setLiveCrop(spread.slot_crops?.[slotId] ?? { x: 50, y: 50 });
    setSelection(null);
    setCropNatural(null);
    const photoId = spread.slots[slotId];
    const photo = photoId ? photosById.get(photoId) : undefined;
    if (photo?.url) {
      const session = ++cropSession.current;
      const img = new Image();
      img.onload = () => {
        if (cropSession.current !== session) return; // stale load
        setCropNatural({ w: img.naturalWidth, h: img.naturalHeight });
      };
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
      live: liveCrop,
    };
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Capture is an enhancement; some environments reject the pointer id.
    }
  }

  function onCropPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const drag = cropDrag.current;
    if (!drag || drag.naturalW === 0 || drag.naturalH === 0 || !cropSlotId) return;
    const scale = Math.max(drag.boxW / drag.naturalW, drag.boxH / drag.naturalH);
    const overflowX = drag.naturalW * scale - drag.boxW;
    const overflowY = drag.naturalH * scale - drag.boxH;
    const clamp = (n: number) => Math.max(0, Math.min(100, n));
    const next: SlotCrop = {
      x:
        overflowX > 1
          ? clamp(drag.startCrop.x - ((event.clientX - drag.startX) / overflowX) * 100)
          : drag.startCrop.x,
      y:
        overflowY > 1
          ? clamp(drag.startCrop.y - ((event.clientY - drag.startY) / overflowY) * 100)
          : drag.startCrop.y,
    };
    drag.live = next;
    // Direct DOM write: re-rendering the whole workspace (23 rail previews,
    // the filmstrip, ~150 tray photos) per pointer event visibly stutters on
    // phones; only this one img needs to move.
    const img = canvasRef.current?.querySelector<HTMLImageElement>(
      `[data-slot="${cropSlotId}"] img`,
    );
    if (img) img.style.objectPosition = `${next.x}% ${next.y}%`;
  }

  function onCropPointerUp() {
    const drag = cropDrag.current;
    if (!drag || !cropSlotId) return;
    cropDrag.current = null;
    setLiveCrop(drag.live);
    applySpread(
      spread.id,
      {
        ...snapshotOf(spread),
        slot_crops: { ...(spread.slot_crops ?? {}), [cropSlotId]: drag.live },
      },
      true,
    );
  }

  /* ------------------------------------------------------------------ */
  /* Drag and drop (tray → slot).                                       */
  /* ------------------------------------------------------------------ */

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  function onDragStart(event: DragStartEvent) {
    const photoId = event.active.data.current?.photoId as string | undefined;
    if (photoId) setDraggingPhotoId(photoId);
  }

  function onDragEnd(event: DragEndEvent) {
    setDraggingPhotoId(null);
    if (busy) return; // a drop must not overwrite an in-flight redesign
    const photoId = event.active.data.current?.photoId as string | undefined;
    const overId = event.over?.id;
    if (!photoId || typeof overId !== "string" || !overId.startsWith("slot:"))
      return;
    placePhoto(overId.slice(5), photoId);
  }

  /* ------------------------------------------------------------------ */
  /* Keyboard.                                                          */
  /* ------------------------------------------------------------------ */

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
        return;

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") {
        if (tab !== "pages" || cropSlotId || storyOpen) return;
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
        return;
      }
      if (event.key === "Escape") {
        if (cropSlotId) exitCropMode();
        else if (storyOpen) setStoryOpen(false);
        else setSelection(null);
        return;
      }
      if (tab !== "pages" || storyOpen || cropSlotId) return;
      if (event.key === "ArrowLeft") {
        setSelection(null);
        setCurrent((c) => Math.max(0, c - 1));
      }
      if (event.key === "ArrowRight") {
        setSelection(null);
        setCurrent((c) => Math.min(spreads.length - 1, c + 1));
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        cycle(-1);
      }
      if (event.key === "ArrowDown") {
        event.preventDefault();
        cycle(1);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // The handler reads fresh state each keystroke; deps cover the values it
    // closes over at bind time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, storyOpen, cropSlotId, spreads.length, undo, redo, spread?.id, spreadPhotos, busy]);

  if (!spread) return null;

  const selectedSlotAccepts: SlotAccepts | null =
    selection?.kind === "slot"
      ? (template?.slots.find((s) => s.id === selection.slotId)?.accepts ?? null)
      : null;
  const draggingPhoto = draggingPhotoId ? photosById.get(draggingPhotoId) : null;
  const regensLeft = 3 - (spread.regen_count ?? 0);

  return (
    // The stable id keeps dnd-kit's generated aria ids identical between
    // server and client render — without it, hydration warns on every
    // draggable.
    <DndContext
      id="album-editor-dnd"
      sensors={sensors}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    >
      <div className="flex h-dvh flex-col bg-ink">
        {/* ---- Top bar ---- */}
        <header className="flex items-center gap-3 border-b border-stone px-4 py-2.5">
          <Link
            href={`/albums/${albumId}`}
            className="text-xs text-slate transition-colors hover:text-pewter"
          >
            ← Done
          </Link>
          <h1 className="hidden font-display text-lg text-parchment sm:block">
            {albumTitle}
          </h1>

          <div className="ml-2 flex items-center gap-1">
            <button
              type="button"
              onClick={undo}
              disabled={undoStack.length === 0 || busy}
              aria-label="Undo"
              title="Undo (⌘Z)"
              className="rounded px-2 py-1 text-sm text-pewter transition-colors hover:text-parchment disabled:opacity-30"
            >
              ↶
            </button>
            <button
              type="button"
              onClick={redo}
              disabled={redoStack.length === 0 || busy}
              aria-label="Redo"
              title="Redo (⇧⌘Z)"
              className="rounded px-2 py-1 text-sm text-pewter transition-colors hover:text-parchment disabled:opacity-30"
            >
              ↷
            </button>
            <span
              className="ml-1 hidden text-[11px] text-slate sm:block"
              aria-live="polite"
            >
              {busy ? "Saving…" : "Saved"}
            </span>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={() => setWarningsOpen((o) => !o)}
              aria-label={`Warnings: ${warnings.length}`}
              className={`relative rounded px-2 py-1 text-sm transition-colors ${
                warnings.length > 0
                  ? "text-pewter hover:text-parchment"
                  : "text-stone"
              }`}
            >
              ◍
              {warnings.length > 0 ? (
                <span className="absolute -right-0.5 -top-0.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-parchment px-0.5 text-[9px] text-ink">
                  {warnings.length}
                </span>
              ) : null}
            </button>

            <div className="flex overflow-hidden rounded-md border border-stone">
              {(["pages", "cover"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTab(t)}
                  className={`px-3 py-1.5 text-xs transition-colors ${
                    tab === t
                      ? "bg-parchment text-ink"
                      : "text-pewter hover:text-parchment"
                  }`}
                >
                  {t === "pages" ? "Pages" : "Cover"}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setStoryOpen(true)}
              className="rounded-md border border-stone px-3 py-1.5 text-xs text-pewter transition-colors hover:border-pewter hover:text-parchment"
            >
              The story
            </button>
            <Link
              href={`/albums/${albumId}`}
              className="rounded-md bg-parchment px-4 py-1.5 text-xs text-ink transition-opacity hover:opacity-90"
            >
              Preview
            </Link>
          </div>
        </header>

        {coach ? (
          <div className="flex items-center justify-between gap-3 border-b border-stone px-4 py-2">
            <p className="text-xs text-pewter">
              Tap a photo, then tap where it goes. Layouts on the left use
              your photos. Everything saves itself — and ⌘Z undoes anything,
              even a redesign.
            </p>
            <button
              type="button"
              onClick={dismissCoach}
              className="shrink-0 text-xs text-slate hover:text-parchment"
            >
              Got it
            </button>
          </div>
        ) : null}

        {error ? (
          <p
            role="alert"
            className="border-b border-stone px-4 py-1.5 text-xs text-pewter"
          >
            {error}
          </p>
        ) : null}

        {warningsOpen && warnings.length > 0 ? (
          <div className="border-b border-stone px-4 py-2">
            <ul className="flex flex-col gap-1">
              {warnings.map((w) => (
                <li key={w.message}>
                  <button
                    type="button"
                    onClick={() => {
                      setTab("pages");
                      setCurrent(w.spreadIndex);
                      setWarningsOpen(false);
                    }}
                    className="text-xs text-pewter underline-offset-4 hover:underline"
                  >
                    {w.message} Fill it from the tray →
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {/* ---- Workspace ---- */}
        {/* CoverDesigner stays mounted so switching tabs never discards
            unsaved title/subtitle/hero edits. */}
        <div
          className={tab === "cover" ? "flex-1 overflow-y-auto px-6 py-6" : "hidden"}
        >
          <div className="mx-auto max-w-2xl">
            <CoverDesigner
              albumId={albumId}
              photos={photos}
              sizeSpec={sizeSpec}
              initialCover={initialCover}
            />
          </div>
        </div>
        {tab === "pages" ? (
          <>
            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto lg:grid lg:grid-cols-[272px_minmax(0,1fr)_300px] lg:overflow-hidden">
              {/* Design rail */}
              <aside className="order-3 border-t border-stone lg:order-none lg:overflow-y-auto lg:border-r lg:border-t-0">
                <TemplateRail
                  currentCode={spread.template_code}
                  spreadPhotos={spreadPhotos}
                  photoUrlMap={photoUrlMap}
                  sizeSpec={sizeSpec}
                  disabled={busy}
                  onApply={applyTemplate}
                />
              </aside>

              {/* Canvas */}
              <section className="order-1 flex min-h-0 flex-col lg:order-none">
                <div className="flex min-h-0 flex-1 items-center justify-center p-4 lg:p-8">
                  <div ref={canvasRef} className="relative w-full max-w-4xl">
                    <SpreadRenderer
                      templateCode={spread.template_code}
                      slots={spread.slots}
                      photosById={photoUrlMap}
                      sizeSpec={sizeSpec}
                      crops={
                        cropSlotId && liveCrop
                          ? {
                              ...(spread.slot_crops ?? {}),
                              [cropSlotId]: liveCrop,
                            }
                          : spread.slot_crops
                      }
                      flipped={spread.flipped}
                      showFold
                      className="shadow-[0_2px_60px_rgba(0,0,0,0.7)]"
                    />
                    {template
                      ? template.slots.map((slot) => {
                          const rect = spread.flipped
                            ? mirroredRect(slot.rect)
                            : slot.rect;
                          return (
                            <SlotOverlay
                              key={slot.id}
                              slotId={slot.id}
                              rect={rect}
                              occupied={Boolean(spread.slots[slot.id])}
                              selected={
                                selection?.kind === "slot" &&
                                selection.slotId === slot.id
                              }
                              cropActive={cropSlotId === slot.id}
                              liveCrop={liveCrop}
                              onTap={() => onSlotTap(slot.id)}
                              onDoubleTap={() => {
                                if (spread.slots[slot.id]) enterCropMode(slot.id);
                              }}
                              cropHandlers={{
                                onPointerDown: onCropPointerDown,
                                onPointerMove: onCropPointerMove,
                                onPointerUp: onCropPointerUp,
                              }}
                            />
                          );
                        })
                      : null}
                  </div>
                </div>

                {/* Contextual bar */}
                <div className="flex flex-wrap items-center justify-between gap-2 px-4 pb-3">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setSelection(null);
                        setCurrent(Math.max(0, current - 1));
                      }}
                      disabled={current === 0}
                      aria-label="Previous spread"
                      className="rounded-md border border-stone px-3 py-1.5 text-sm text-pewter disabled:opacity-30"
                    >
                      ←
                    </button>
                    <span
                      className="text-[11px] tracking-widest text-slate"
                      title={`Spread ${current + 1} of ${spreads.length}`}
                    >
                      PAGES {current * 2 + 1}–{current * 2 + 2} OF{" "}
                      {spreads.length * 2}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setSelection(null);
                        setCurrent(Math.min(spreads.length - 1, current + 1));
                      }}
                      disabled={current === spreads.length - 1}
                      aria-label="Next spread"
                      className="rounded-md border border-stone px-3 py-1.5 text-sm text-pewter disabled:opacity-30"
                    >
                      →
                    </button>
                  </div>

                  {cropSlotId ? (
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-pewter">
                        Drag the photo to reframe. Saves as you go.
                      </span>
                      <button
                        type="button"
                        onClick={exitCropMode}
                        className="rounded-md bg-parchment px-4 py-1.5 text-xs text-ink"
                      >
                        Done
                      </button>
                    </div>
                  ) : selection?.kind === "slot" && spread.slots[selection.slotId] ? (
                    <div className="flex items-center gap-2">
                      <span className="hidden text-xs text-pewter md:block">
                        Tap another slot to swap, or a tray photo to replace.
                      </span>
                      <button
                        type="button"
                        onClick={() => enterCropMode(selection.slotId)}
                        className="rounded-md border border-stone px-3 py-1.5 text-xs text-pewter hover:border-pewter hover:text-parchment"
                      >
                        Reframe
                      </button>
                      <button
                        type="button"
                        disabled={busy || regensLeft <= 0}
                        onClick={() =>
                          void redesignSpread(
                            "hero",
                            spread.slots[selection.slotId],
                          )
                        }
                        title="Rebuild this spread around this photo"
                        className="rounded-md border border-stone px-3 py-1.5 text-xs text-pewter hover:border-pewter hover:text-parchment disabled:opacity-30"
                      >
                        Make it the hero
                      </button>
                      <button
                        type="button"
                        onClick={() => removeFromSlot(selection.slotId)}
                        className="rounded-md border border-stone px-3 py-1.5 text-xs text-pewter hover:border-pewter hover:text-parchment"
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={flipSpread}
                        disabled={busy}
                        className="rounded-md border border-stone px-3 py-1.5 text-xs text-pewter transition-colors hover:border-pewter hover:text-parchment disabled:opacity-30"
                      >
                        Flip spread
                      </button>
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setRedesignMenuOpen((o) => !o)}
                          disabled={busy || regensLeft <= 0}
                          title={
                            regensLeft > 0
                              ? `${regensLeft} of 3 redesigns left — undo is free`
                              : "This spread has been redesigned three times"
                          }
                          className="rounded-md border border-stone px-3 py-1.5 text-xs text-pewter transition-colors hover:border-pewter hover:text-parchment disabled:opacity-30"
                        >
                          {regenBusy
                            ? "Redesigning…"
                            : `Redesign (${regensLeft} left) ▾`}
                        </button>
                        {redesignMenuOpen ? (
                          <div className="absolute bottom-full right-0 z-20 mb-1 flex w-52 flex-col overflow-hidden rounded-md border border-stone bg-charcoal">
                            {(
                              [
                                ["surprise", "Surprise me"],
                                ["fewer", "Fewer photos, bigger"],
                                ["add", "Add one more moment"],
                                ["calmer", "Calmer"],
                              ] as Array<[RegenIntent, string]>
                            ).map(([intentKey, label]) => {
                              const disabled =
                                (intentKey === "fewer" &&
                                  Object.keys(spread.slots).length < 2) ||
                                (intentKey === "add" &&
                                  placedIds.size >= photos.length);
                              return (
                                <button
                                  key={intentKey}
                                  type="button"
                                  disabled={disabled}
                                  onClick={() => void redesignSpread(intentKey)}
                                  className="px-3 py-2 text-left text-xs text-pewter transition-colors hover:bg-stone hover:text-parchment disabled:opacity-30"
                                >
                                  {label}
                                </button>
                              );
                            })}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  )}
                </div>

                {notice ? (
                  <p className="px-4 pb-3 font-display text-sm italic text-pewter">
                    “{notice}”
                  </p>
                ) : null}
              </section>

              {/* Photo tray */}
              <aside className="order-2 border-t border-stone lg:order-none lg:overflow-y-auto lg:border-l lg:border-t-0">
                <PhotoTray
                  photos={photos}
                  placedIds={placedIds}
                  alternatives={alternatives}
                  selectedSlotAccepts={selectedSlotAccepts}
                  selectedTrayPhotoId={
                    selection?.kind === "tray" ? selection.photoId : null
                  }
                  onSelect={onTraySelect}
                />
              </aside>
            </div>

            {/* Bottom filmstrip */}
            <footer className="border-t border-stone">
              <Filmstrip
                spreads={spreads}
                current={current}
                photoUrlMap={photoUrlMap}
                sizeSpec={sizeSpec}
                coverUrl={
                  initialCover.hero_photo_id
                    ? (photosById.get(initialCover.hero_photo_id)?.url ?? null)
                    : null
                }
                coverActive={false}
                onNavigate={(i) => {
                  setSelection(null);
                  setCurrent(i);
                }}
                onOpenCover={() => setTab("cover")}
              />
            </footer>
          </>
        ) : null}

        {storyOpen ? (
          <StoryView
            spreads={spreads}
            spreadStages={spreadStages}
            photoUrlMap={photoUrlMap}
            sizeSpec={sizeSpec}
            busy={busy}
            onReorder={(ids) => applyOrder(ids, true)}
            onOpenSpread={(i) => {
              setSelection(null);
              setCurrent(i);
              setStoryOpen(false);
            }}
            onClose={() => setStoryOpen(false)}
          />
        ) : null}

        <DragOverlay dropAnimation={null}>
          {draggingPhoto?.url ? (
            <img
              src={draggingPhoto.url}
              alt=""
              className="h-20 w-20 rounded-sm object-cover opacity-80 shadow-lg"
            />
          ) : null}
        </DragOverlay>
      </div>
    </DndContext>
  );
}

/* ----------------------------------------------------------------------- */

function SlotOverlay({
  slotId,
  rect,
  occupied,
  selected,
  cropActive,
  liveCrop,
  onTap,
  onDoubleTap,
  cropHandlers,
}: {
  slotId: string;
  rect: { x: number; y: number; w: number; h: number };
  occupied: boolean;
  selected: boolean;
  cropActive: boolean;
  liveCrop: SlotCrop | null;
  onTap: () => void;
  onDoubleTap: () => void;
  cropHandlers: {
    onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void;
    onPointerMove: (e: React.PointerEvent<HTMLDivElement>) => void;
    onPointerUp: () => void;
  };
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `slot:${slotId}`,
    data: { slotId },
  });

  const style = {
    left: `${rect.x * 100}%`,
    top: `${rect.y * 100}%`,
    width: `${rect.w * 100}%`,
    height: `${rect.h * 100}%`,
  };

  if (cropActive) {
    return (
      <div
        role="slider"
        aria-label={`Reframe ${slotId}`}
        aria-valuenow={liveCrop ? Math.round(liveCrop.x) : 50}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuetext={
          liveCrop
            ? `${Math.round(liveCrop.x)}%, ${Math.round(liveCrop.y)}%`
            : undefined
        }
        onPointerDown={cropHandlers.onPointerDown}
        onPointerMove={cropHandlers.onPointerMove}
        onPointerUp={cropHandlers.onPointerUp}
        className="absolute cursor-move ring-2 ring-white"
        style={{ ...style, touchAction: "none" }}
      />
    );
  }

  return (
    <button
      ref={setNodeRef}
      type="button"
      onClick={onTap}
      onDoubleClick={onDoubleTap}
      aria-label={`Slot ${slotId}${occupied ? "" : ", empty"}`}
      className={`absolute transition-shadow ${
        selected
          ? "ring-2 ring-white"
          : isOver
            ? "bg-white/10 ring-2 ring-white/80"
            : "hover:ring-1 hover:ring-white/50"
      }`}
      style={style}
    />
  );
}
