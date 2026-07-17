/* eslint-disable @next/next/no-img-element */
"use client";

/**
 * The intelligent photo tray. Every photo in the album, used-state tracked
 * (dimmed + check when placed — "what haven't I used" is THE tray query),
 * sorted by the AI's hero score, filterable to what fits the selected slot.
 * Photos drag out to slots, or click to fill the active slot.
 */

import { useDraggable } from "@dnd-kit/core";
import { useMemo, useState } from "react";

import { slotAcceptsPhoto, type SlotAccepts } from "@/lib/engine/templates";

import type { EditorPhoto } from "./album-editor";

type TrayFilter = "all" | "unused" | "fits";

export function PhotoTray({
  photos,
  placedIds,
  selectedSlotAccepts,
  selectedTrayPhotoId,
  onSelect,
}: {
  photos: EditorPhoto[];
  placedIds: ReadonlySet<string>;
  /** The accepts constraint of the selected slot, when one is selected. */
  selectedSlotAccepts: SlotAccepts | null;
  selectedTrayPhotoId: string | null;
  onSelect: (photoId: string) => void;
}) {
  const [filter, setFilter] = useState<TrayFilter>("all");
  const [sort, setSort] = useState<"hero" | "upload">("hero");

  const usedCount = photos.filter((p) => placedIds.has(p.id)).length;

  const visible = useMemo(() => {
    let list = photos.filter((p) => p.url);
    if (filter === "unused") list = list.filter((p) => !placedIds.has(p.id));
    if (filter === "fits" && selectedSlotAccepts) {
      list = list.filter((p) =>
        slotAcceptsPhoto(selectedSlotAccepts, p.orientation),
      );
    }
    if (sort === "hero") {
      list = [...list].sort((a, b) => b.heroPotential - a.heroPotential);
    }
    return list;
  }, [photos, placedIds, filter, selectedSlotAccepts, sort]);

  const chip = (value: TrayFilter, label: string, show = true) =>
    show ? (
      <button
        key={value}
        type="button"
        onClick={() => setFilter(filter === value ? "all" : value)}
        className={`rounded-full px-3 py-1 text-[11px] transition-colors ${
          filter === value
            ? "bg-parchment text-ink"
            : "border border-stone text-pewter hover:text-parchment"
        }`}
      >
        {label}
      </button>
    ) : null;

  return (
    <div className="flex h-full flex-col gap-3 p-3">
      <div className="flex items-baseline justify-between px-1">
        <h3 className="text-[11px] tracking-widest text-slate">PHOTOS</h3>
        <span className="text-[11px] text-slate">
          {usedCount} of {photos.length} placed
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 px-1">
        {chip("all", "All")}
        {chip("unused", "Unused")}
        {chip("fits", "Fits this slot", selectedSlotAccepts !== null)}
        <button
          type="button"
          onClick={() => setSort(sort === "hero" ? "upload" : "hero")}
          className="ml-auto text-[11px] text-slate transition-colors hover:text-pewter"
          title="Toggle sort"
        >
          {sort === "hero" ? "Our picks first" : "Upload order"}
        </button>
      </div>

      <div className="grid flex-1 auto-rows-min grid-cols-3 gap-1.5 overflow-y-auto pr-1 max-lg:flex max-lg:overflow-x-auto max-lg:pb-1">
        {visible.map((photo) => (
          <TrayPhoto
            key={photo.id}
            photo={photo}
            used={placedIds.has(photo.id)}
            selected={selectedTrayPhotoId === photo.id}
            onSelect={() => onSelect(photo.id)}
          />
        ))}
        {visible.length === 0 ? (
          <p className="col-span-3 py-6 text-center text-xs text-slate">
            Nothing matches. Clear a filter.
          </p>
        ) : null}
      </div>
    </div>
  );
}

function TrayPhoto({
  photo,
  used,
  selected,
  onSelect,
}: {
  photo: EditorPhoto;
  used: boolean;
  selected: boolean;
  onSelect: () => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `tray:${photo.id}`,
    data: { photoId: photo.id },
    disabled: used,
  });

  return (
    <button
      ref={setNodeRef}
      type="button"
      onClick={onSelect}
      {...listeners}
      {...attributes}
      // dnd-kit's announcer id drifts between server and client under dev
      // StrictMode; the attribute is a benign aria pointer.
      suppressHydrationWarning
      aria-label={used ? "Photo, already placed" : "Tray photo"}
      className={`relative aspect-square w-full shrink-0 overflow-hidden rounded-sm border transition-all max-lg:w-20 ${
        selected ? "border-white" : "border-stone"
      } ${used ? "opacity-40" : "hover:border-pewter"} ${
        isDragging ? "opacity-30" : ""
      }`}
    >
      {photo.url ? (
        <img
          src={photo.url}
          alt=""
          loading="lazy"
          decoding="async"
          draggable={false}
          className="h-full w-full object-cover"
        />
      ) : (
        <span className="block h-full w-full bg-stone" />
      )}
      {used ? (
        <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-ink/80 text-[9px] text-pewter">
          ✓
        </span>
      ) : null}
      {photo.setAsideReason && !used ? (
        <span
          title={photo.setAsideReason}
          className="absolute bottom-1 left-1 rounded-sm bg-ink/70 px-1 text-[8px] text-pewter"
        >
          set aside
        </span>
      ) : null}
    </button>
  );
}
