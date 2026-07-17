"use client";

/**
 * The Design rail: every template that fits the current spread's photos,
 * rendered LIVE with those photos — never a grey wireframe. Couples judge
 * layouts by seeing their own images in them; this is the interaction that
 * makes a constrained template set feel like taste instead of limitation.
 */

import { useMemo } from "react";

import { SpreadRenderer } from "@/components/spreads/spread-renderer";
import {
  assignPhotosToTemplate,
  compatibleTemplates,
} from "@/lib/engine/editing";

import type { AlbumSizeSpec } from "@/lib/albums/sizes";
import type { EnginePhoto } from "@/lib/engine/engine";
import type { SpreadPhoto } from "@/components/spreads/spread-renderer";

export function TemplateRail({
  currentCode,
  spreadPhotos,
  photoUrlMap,
  sizeSpec,
  disabled,
  onApply,
}: {
  currentCode: string;
  /** Photos on the current spread, strongest first. */
  spreadPhotos: EnginePhoto[];
  photoUrlMap: ReadonlyMap<string, SpreadPhoto>;
  sizeSpec: AlbumSizeSpec;
  disabled: boolean;
  onApply: (templateCode: string, assignment: Record<string, string>) => void;
}) {
  const options = useMemo(() => {
    if (spreadPhotos.length === 0) return [];
    return compatibleTemplates(spreadPhotos)
      .map((template) => ({
        template,
        assignment: assignPhotosToTemplate(template, spreadPhotos),
      }))
      .filter(
        (o): o is { template: (typeof o)["template"]; assignment: Record<string, string> } =>
          o.assignment !== null,
      );
  }, [spreadPhotos]);

  if (options.length === 0) {
    return (
      <p className="px-4 py-6 text-xs text-slate">
        Put a photo on this spread to see layouts.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2 p-3">
      <div className="flex items-baseline justify-between px-1">
        <h3 className="text-[11px] tracking-widest text-slate">LAYOUTS</h3>
        <span className="text-[11px] text-slate">
          {options.length} fit these photos
        </span>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1 lg:grid lg:grid-cols-2 lg:overflow-visible">
        {options.map(({ template, assignment }) => {
          const isActive = template.code === currentCode;
          return (
            <button
              key={template.code}
              type="button"
              disabled={disabled || isActive}
              onClick={() => onApply(template.code, assignment)}
              title={`${template.name} — ${template.description}`}
              aria-label={`Layout ${template.code}: ${template.name}`}
              className={`group relative w-32 shrink-0 overflow-hidden rounded-sm border transition-all lg:w-auto ${
                isActive
                  ? "border-parchment"
                  : "border-stone opacity-75 hover:border-pewter hover:opacity-100"
              }`}
            >
              <SpreadRenderer
                templateCode={template.code}
                slots={assignment}
                photosById={photoUrlMap}
                sizeSpec={sizeSpec}
              />
              <span
                className={`absolute inset-x-0 bottom-0 truncate px-1.5 py-0.5 text-left text-[9px] ${
                  isActive ? "bg-parchment text-ink" : "bg-ink/70 text-pewter"
                }`}
              >
                {template.name}
              </span>
            </button>
          );
        })}
      </div>
      <p className="px-1 text-[10px] leading-relaxed text-slate">
        ↑↓ cycles layouts with your photos re-flowed. Every change is one
        undo away.
      </p>
    </div>
  );
}
