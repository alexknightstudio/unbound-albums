import { notFound } from "next/navigation";

import { SpreadRenderer } from "@/components/spreads/spread-renderer";
import {
  ALBUM_SIZE_SPECS,
  DEFAULT_ALBUM_SIZE,
  isAlbumSize,
  PRINT_DPI,
} from "@/lib/albums/sizes";
import { createAdminClient } from "@/lib/supabase/admin";

import type { SpreadPhoto } from "@/components/spreads/spread-renderer";
import type { SlotCrop } from "@/lib/engine/templates";

/**
 * The print surface — DESIGNER_SPEC.md Phase D1.
 *
 * One spread, mounted at its exact Miller's print pixel dimensions
 * (page width × 2 × 250 DPI), drawn by the same SpreadRenderer as every
 * preview. Puppeteer (scripts/render-print.mjs) sets the viewport to these
 * dimensions and captures page.screenshot() — same component, same fonts,
 * same crop math, same rasterizer as the couple's preview. That identity is
 * the WYSIWYG guarantee.
 *
 * Access: server-to-server only, gated by PRINT_RENDER_TOKEN. Uses original
 * full-resolution files (never thumbs). No fold shadow — that's a screen
 * affordance, not ink.
 */

type SpreadRow = {
  id: string;
  album_id: string;
  template_code: string;
  slots: Record<string, string>;
  slot_crops: Record<string, SlotCrop> | null;
  flipped: boolean;
};

export default async function PrintSpreadPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ token?: string; size?: string }>;
}) {
  const { id } = await params;
  const { token, size: sizeOverride } = await searchParams;

  const expected = process.env.PRINT_RENDER_TOKEN;
  if (!expected || !token || token !== expected) notFound();

  const admin = createAdminClient();

  const { data: spread } = await admin
    .from("spreads")
    .select("id, album_id, template_code, slots, slot_crops, flipped")
    .eq("id", id)
    .maybeSingle<SpreadRow>();
  if (!spread) notFound();

  const { data: album } = await admin
    .from("albums")
    .select("size")
    .eq("id", spread.album_id)
    .maybeSingle<{ size: string }>();

  // A size override exists so the largest formats can be validated against
  // Puppeteer's large-capture limits without mutating an album.
  const size = isAlbumSize(sizeOverride)
    ? sizeOverride
    : isAlbumSize(album?.size)
      ? album.size
      : DEFAULT_ALBUM_SIZE;
  const spec = ALBUM_SIZE_SPECS[size];
  const widthPx = spec.pageWidthIn * 2 * PRINT_DPI;
  const heightPx = spec.pageHeightIn * PRINT_DPI;

  const photoIds = [...new Set(Object.values(spread.slots))];
  const { data: photos } = await admin
    .from("photos")
    .select("id, storage_path")
    .in("id", photoIds)
    .returns<Array<{ id: string; storage_path: string }>>();

  const paths = (photos ?? []).map((p) => p.storage_path);
  const { data: signed } = await admin.storage
    .from("originals")
    .createSignedUrls(paths, 60 * 60);
  const urlByPath = new Map(
    (signed ?? []).flatMap((s) =>
      s.signedUrl ? [[s.path, s.signedUrl] as const] : [],
    ),
  );

  const photosById: ReadonlyMap<string, SpreadPhoto> = new Map(
    (photos ?? []).flatMap((p) => {
      const url = urlByPath.get(p.storage_path);
      return url ? [[p.id, { url }] as const] : [];
    }),
  );

  return (
    <main
      id="print-root"
      data-print-size={size}
      style={{ width: widthPx, height: heightPx }}
    >
      <SpreadRenderer
        templateCode={spread.template_code}
        slots={spread.slots}
        photosById={photosById}
        sizeSpec={spec}
        crops={spread.slot_crops ?? undefined}
        flipped={spread.flipped}
      />
    </main>
  );
}
