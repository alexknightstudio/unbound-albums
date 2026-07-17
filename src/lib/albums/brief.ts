/**
 * The style brief — the questionnaire a couple answers after uploading.
 *
 * This is the couple's entire creative input (the pivot: designers design,
 * couples direct). Everything lives here as data so options can grow without
 * touching UI code, exactly like sizes.ts. Stored on albums.brief as jsonb.
 */

export const COVER_MATERIALS = [
  {
    value: "linen",
    label: "Linen",
    description: "Woven, soft, quietly textured.",
    colors: ["Oat", "Ivory", "Charcoal", "Slate blue"],
  },
  {
    value: "leather",
    label: "Leather",
    description: "Smooth, classic, ages beautifully.",
    colors: ["Black", "Chestnut", "Tan", "Navy"],
  },
  {
    value: "distressed_leather",
    label: "Distressed leather",
    description: "Rugged grain, heirloom feel.",
    colors: ["Whiskey", "Espresso", "Saddle"],
  },
  {
    value: "velvet",
    label: "Velvet",
    description: "Deep, plush, unapologetically romantic.",
    colors: ["Dusty rose", "Emerald", "Midnight"],
  },
] as const;

export type CoverMaterial = (typeof COVER_MATERIALS)[number]["value"];

export const CAMEO_OPTIONS = [
  {
    value: "none",
    label: "No cameo",
    description: "A clean cover — your names and date in foil.",
  },
  {
    value: "front",
    label: "Front cameo",
    description: "A small photo window set into the cover.",
  },
] as const;

export type CameoOption = (typeof CAMEO_OPTIONS)[number]["value"];

export const FONT_STYLES = [
  {
    value: "serif",
    label: "Serif",
    description: "Classic and editorial. Timeless.",
  },
  {
    value: "script",
    label: "Script",
    description: "Handwritten warmth. Romantic.",
  },
  {
    value: "modern",
    label: "Modern",
    description: "Clean lines, no flourish. Understated.",
  },
] as const;

export type FontStyle = (typeof FONT_STYLES)[number]["value"];

export const DESIGN_MOODS = [
  {
    value: "classic",
    label: "Clean & classic",
    description: "Generous white space, timeless pacing.",
  },
  {
    value: "editorial",
    label: "Editorial & dramatic",
    description: "Big full-bleed moments, bold contrasts.",
  },
  {
    value: "romantic",
    label: "Soft & romantic",
    description: "Gentle sequences, tender details.",
  },
] as const;

export type DesignMood = (typeof DESIGN_MOODS)[number]["value"];

export type AlbumBrief = {
  cover_material: CoverMaterial;
  cover_color: string;
  cameo: CameoOption;
  font_style: FontStyle;
  mood: DesignMood;
  /** Cover foil text — usually names and a date. */
  title_text: string;
  /** Anything the couple wants the designer to know. */
  notes: string;
};

function isOneOf<T extends string>(
  value: unknown,
  options: readonly { value: T }[],
): value is T {
  return (
    typeof value === "string" && options.some((o) => o.value === value)
  );
}

/** Parse an unknown payload into a brief, or explain what's wrong. */
export function parseBrief(
  input: unknown,
): { ok: true; brief: AlbumBrief } | { ok: false; message: string } {
  const raw = (input ?? {}) as Record<string, unknown>;

  if (!isOneOf(raw.cover_material, COVER_MATERIALS)) {
    return { ok: false, message: "Pick a cover material." };
  }
  const material = COVER_MATERIALS.find(
    (m) => m.value === raw.cover_material,
  )!;
  const colors: readonly string[] = material.colors;
  if (typeof raw.cover_color !== "string" || !colors.includes(raw.cover_color)) {
    return { ok: false, message: "Pick a cover color." };
  }
  if (!isOneOf(raw.cameo, CAMEO_OPTIONS)) {
    return { ok: false, message: "Choose a cameo option." };
  }
  if (!isOneOf(raw.font_style, FONT_STYLES)) {
    return { ok: false, message: "Pick a font style." };
  }
  if (!isOneOf(raw.mood, DESIGN_MOODS)) {
    return { ok: false, message: "Pick a design mood." };
  }
  const title = typeof raw.title_text === "string" ? raw.title_text.trim() : "";
  if (title.length === 0) {
    return { ok: false, message: "Tell us what the cover should say." };
  }
  if (title.length > 120) {
    return { ok: false, message: "Cover text runs long — keep it under 120 characters." };
  }
  const notes =
    typeof raw.notes === "string" ? raw.notes.trim().slice(0, 2000) : "";

  return {
    ok: true,
    brief: {
      cover_material: raw.cover_material,
      cover_color: raw.cover_color,
      cameo: raw.cameo,
      font_style: raw.font_style,
      mood: raw.mood,
      title_text: title,
      notes,
    },
  };
}

/** Human-readable one-liner for lists and the studio queue. */
export function briefSummary(brief: AlbumBrief): string {
  const material = COVER_MATERIALS.find((m) => m.value === brief.cover_material);
  const font = FONT_STYLES.find((f) => f.value === brief.font_style);
  const mood = DESIGN_MOODS.find((m) => m.value === brief.mood);
  const cameo = brief.cameo === "front" ? " · cameo" : "";
  return `${material?.label} — ${brief.cover_color}${cameo} · ${font?.label} foil · ${mood?.label}`;
}
