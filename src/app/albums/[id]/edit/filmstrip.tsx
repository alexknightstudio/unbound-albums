"use client";

/**
 * The bottom filmstrip (micro navigation) and the Story view (macro
 * structure): every spread as a live thumbnail. Filmstrip clicks navigate;
 * the Story overlay is where reordering happens — drag via grip handle,
 * with keyboard-accessible move buttons as the fallback.
 */

import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { SpreadRenderer } from "@/components/spreads/spread-renderer";

import type { ViewerSpread } from "@/components/album/album-viewer";
import type { AlbumSizeSpec } from "@/lib/albums/sizes";
import type { SpreadPhoto } from "@/components/spreads/spread-renderer";

export function Filmstrip({
  spreads,
  current,
  photoUrlMap,
  sizeSpec,
  onNavigate,
}: {
  spreads: ViewerSpread[];
  current: number;
  photoUrlMap: ReadonlyMap<string, SpreadPhoto>;
  sizeSpec: AlbumSizeSpec;
  onNavigate: (index: number) => void;
}) {
  return (
    <div
      className="scrollbar-none flex gap-2 overflow-x-auto px-3 py-2"
      style={{ scrollbarWidth: "none" }}
    >
      {spreads.map((spread, i) => (
        <button
          key={spread.id}
          type="button"
          onClick={() => onNavigate(i)}
          aria-label={`Go to spread ${i + 1}`}
          className={`relative w-24 shrink-0 overflow-hidden rounded-sm border transition-colors ${
            i === current
              ? "border-parchment"
              : "border-stone opacity-60 hover:opacity-100"
          }`}
        >
          <SpreadRenderer
            templateCode={spread.template_code}
            slots={spread.slots}
            photosById={photoUrlMap}
            sizeSpec={sizeSpec}
            crops={spread.slot_crops}
            flipped={spread.flipped}
          />
          <span className="absolute bottom-0.5 left-1 text-[9px] text-slate">
            {i + 1}
          </span>
        </button>
      ))}
    </div>
  );
}

export function StoryView({
  spreads,
  photoUrlMap,
  sizeSpec,
  busy,
  onReorder,
  onOpenSpread,
  onClose,
}: {
  spreads: ViewerSpread[];
  photoUrlMap: ReadonlyMap<string, SpreadPhoto>;
  sizeSpec: AlbumSizeSpec;
  busy: boolean;
  onReorder: (orderedIds: string[]) => void;
  onOpenSpread: (index: number) => void;
  onClose: () => void;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = spreads.findIndex((s) => s.id === active.id);
    const newIndex = spreads.findIndex((s) => s.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    onReorder(arrayMove(spreads, oldIndex, newIndex).map((s) => s.id));
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-ink/98">
      <div className="flex items-center justify-between border-b border-stone px-6 py-4">
        <div>
          <h2 className="font-display text-2xl text-parchment">The story.</h2>
          <p className="text-xs text-slate">
            Drag spreads to re-pace the day. Click one to edit it.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md bg-parchment px-4 py-2 text-sm text-ink"
        >
          Done
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <DndContext
          id="story-view-dnd"
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={onDragEnd}
        >
          <SortableContext
            items={spreads.map((s) => s.id)}
            strategy={rectSortingStrategy}
          >
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {spreads.map((spread, i) => (
                <StoryCard
                  key={spread.id}
                  spread={spread}
                  index={i}
                  photoUrlMap={photoUrlMap}
                  sizeSpec={sizeSpec}
                  busy={busy}
                  onOpen={() => onOpenSpread(i)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </div>
    </div>
  );
}

function StoryCard({
  spread,
  index,
  photoUrlMap,
  sizeSpec,
  busy,
  onOpen,
}: {
  spread: ViewerSpread;
  index: number;
  photoUrlMap: ReadonlyMap<string, SpreadPhoto>;
  sizeSpec: AlbumSizeSpec;
  busy: boolean;
  onOpen: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: spread.id, disabled: busy });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      className={`group relative ${isDragging ? "z-10 opacity-80" : ""}`}
    >
      <button
        type="button"
        onClick={onOpen}
        aria-label={`Edit spread ${index + 1}`}
        className="block w-full overflow-hidden rounded-sm border border-stone transition-colors hover:border-pewter"
      >
        <SpreadRenderer
          templateCode={spread.template_code}
          slots={spread.slots}
          photosById={photoUrlMap}
          sizeSpec={sizeSpec}
          crops={spread.slot_crops}
          flipped={spread.flipped}
        />
      </button>
      <div className="mt-1 flex items-center justify-between">
        <span className="text-[11px] text-slate">
          Spread {index + 1} · {spread.template_code}
        </span>
        <button
          type="button"
          aria-label={`Drag to reorder spread ${index + 1}`}
          {...listeners}
          {...attributes}
          suppressHydrationWarning
          style={{ touchAction: "none" }}
          className="cursor-grab rounded px-2 py-0.5 text-xs text-slate opacity-60 transition-opacity hover:text-parchment focus:opacity-100 group-hover:opacity-100 active:cursor-grabbing lg:opacity-0"
        >
          ⠿ drag
        </button>
      </div>
    </div>
  );
}
