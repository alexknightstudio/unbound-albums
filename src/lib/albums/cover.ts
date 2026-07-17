/**
 * Cover design vocabulary. Stored in albums.cover (jsonb).
 */

export const COVER_LAYOUT_STYLES = ["centered", "bottom_left", "minimal"] as const;

export type CoverLayoutStyle = (typeof COVER_LAYOUT_STYLES)[number];

export type AlbumCover = {
  hero_photo_id: string | null;
  title_text: string;
  subtitle_text: string;
  layout_style: CoverLayoutStyle;
};

export const COVER_STYLE_LABELS: Record<CoverLayoutStyle, string> = {
  centered: "Centered",
  bottom_left: "Bottom left",
  minimal: "Minimal",
};

/** Parse whatever is in the jsonb column into a usable cover. */
export function parseCover(value: unknown): AlbumCover {
  const v = (value ?? {}) as Record<string, unknown>;
  const style = COVER_LAYOUT_STYLES.includes(v.layout_style as CoverLayoutStyle)
    ? (v.layout_style as CoverLayoutStyle)
    : "centered";
  return {
    hero_photo_id:
      typeof v.hero_photo_id === "string" ? v.hero_photo_id : null,
    title_text: typeof v.title_text === "string" ? v.title_text : "",
    subtitle_text: typeof v.subtitle_text === "string" ? v.subtitle_text : "",
    layout_style: style,
  };
}
