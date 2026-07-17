import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

import { ALBUM_SIZE_SPECS, type AlbumSize, type AlbumSizeSpec } from "./sizes";

import type { ViewerSpread } from "@/components/album/album-viewer";

export type AlbumPresentation = {
  sizeSpec: AlbumSizeSpec;
  spreads: ViewerSpread[];
  /** photo_id → signed thumb URL (1 hour). */
  photoUrls: Record<string, string>;
  setAside: Array<{ id: string; reason: string; url: string | null }>;
};

/**
 * Everything the viewer needs for one album, with signed URLs for the
 * private thumbs bucket. Callers are responsible for ACCESS — the owner page
 * goes through RLS first; the share page treats the unguessable slug as the
 * capability. This helper reads with the admin client either way.
 */
export async function loadAlbumPresentation(
  albumId: string,
  size: AlbumSize,
): Promise<AlbumPresentation | null> {
  const admin = createAdminClient();

  const [{ data: spreads }, { data: photos }] = await Promise.all([
    admin
      .from("spreads")
      .select("id, position, template_code, slots, slot_crops, flipped, regen_count")
      .eq("album_id", albumId)
      .order("position", { ascending: true })
      .returns<ViewerSpread[]>(),
    admin
      .from("photos")
      .select("id, thumb_path, set_aside_reason")
      .eq("album_id", albumId)
      .returns<
        Array<{
          id: string;
          thumb_path: string | null;
          set_aside_reason: string | null;
        }>
      >(),
  ]);

  if (!spreads || spreads.length === 0 || !photos) return null;

  const thumbPaths = photos
    .map((p) => p.thumb_path)
    .filter((p): p is string => p !== null);
  const { data: signed } = await admin.storage
    .from("thumbs")
    .createSignedUrls(thumbPaths, 60 * 60);

  const urlByPath = new Map(
    (signed ?? [])
      .filter((s) => s.signedUrl)
      .map((s) => [s.path as string, s.signedUrl]),
  );

  const photoUrls: Record<string, string> = {};
  for (const photo of photos) {
    const url = photo.thumb_path ? urlByPath.get(photo.thumb_path) : undefined;
    if (url) photoUrls[photo.id] = url;
  }

  const setAside = photos
    .filter((p) => p.set_aside_reason !== null)
    .map((p) => ({
      id: p.id,
      reason: p.set_aside_reason as string,
      url: photoUrls[p.id] ?? null,
    }));

  return {
    sizeSpec: ALBUM_SIZE_SPECS[size],
    spreads,
    photoUrls,
    setAside,
  };
}
