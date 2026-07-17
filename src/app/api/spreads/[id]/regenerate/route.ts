import { NextResponse, type NextRequest } from "next/server";

import { createAnthropicClient } from "@/lib/ai/client";
import {
  LAYOUT_MODEL,
  SPREAD_REGEN_SYSTEM_PROMPT,
  spreadRegenOutputSchema,
  spreadRegenUserMessage,
  type LayoutPhoto,
  type RegenIntent,
} from "@/lib/ai/prompts/layout";
import { validateSpreadSlots } from "@/lib/engine/editing";
import { TEMPLATES_BY_CODE } from "@/lib/engine/templates";
import { createClient } from "@/lib/supabase/server";

import type { EnginePhoto } from "@/lib/engine/engine";

export const runtime = "nodejs";
export const maxDuration = 120;

type SpreadRow = {
  id: string;
  album_id: string;
  template_code: string;
  slots: Record<string, string>;
  regen_count: number;
};

/**
 * "Regenerate this spread." One Claude call over this spread's photos, a
 * different treatment back, validated before it lands. The 0–3 counter is a
 * database check constraint — the cost guardrail can't be bypassed from here.
 */
const INTENTS: RegenIntent[] = ["surprise", "hero", "fewer", "add", "calmer"];

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const body = await request.json().catch(() => ({}));
  const intent: RegenIntent = INTENTS.includes(body?.intent)
    ? body.intent
    : "surprise";
  const heroPhotoId: string | null =
    typeof body?.heroPhotoId === "string" ? body.heroPhotoId : null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const { data: spread } = await supabase
    .from("spreads")
    .select("id, album_id, template_code, slots, regen_count")
    .eq("id", id)
    .maybeSingle<SpreadRow>();
  if (!spread) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const { data: album } = await supabase
    .from("albums")
    .select("id, status")
    .eq("id", spread.album_id)
    .maybeSingle<{ id: string; status: string }>();
  if (!album || album.status !== "ready") {
    return NextResponse.json(
      { error: "This album can't be edited right now." },
      { status: 409 },
    );
  }

  if (spread.regen_count >= 3) {
    return NextResponse.json(
      { error: "This spread has been reshaped three times — that's the limit." },
      { status: 409 },
    );
  }

  const photoIds = Object.values(spread.slots);
  if (photoIds.length === 0) {
    return NextResponse.json(
      { error: "Nothing on this spread to redesign." },
      { status: 400 },
    );
  }

  const { data: photos } = await supabase
    .from("photos")
    .select("id, upload_order, orientation, analysis")
    .in("id", photoIds)
    .returns<
      Array<{
        id: string;
        upload_order: number;
        orientation: EnginePhoto["orientation"] | null;
        analysis: Record<string, unknown> | null;
      }>
    >();
  if (!photos || photos.length !== photoIds.length) {
    return NextResponse.json({ error: "Could not load photos." }, { status: 500 });
  }

  const layoutPhotos: LayoutPhoto[] = photos.map((p) => {
    const a = p.analysis ?? {};
    return {
      id: p.id,
      upload_order: p.upload_order,
      orientation: p.orientation ?? "landscape",
      stage: String(a.stage ?? "other"),
      time_of_day: String(a.time_of_day ?? "unknown"),
      people: String(a.people ?? "none"),
      is_couple_portrait: Boolean(a.is_couple_portrait),
      emotion: String(a.emotion ?? "none"),
      shot_type: String(a.shot_type ?? "medium"),
      color_profile: String(a.color_profile ?? "color"),
      hero_potential: Number(a.hero_potential ?? 0),
      description: String(a.description ?? ""),
    };
  });

  // Candidate pool for "add": unplaced photos from the same part of the day,
  // strongest first. Unplaced everywhere — so placing one can never duplicate.
  let candidates: LayoutPhoto[] = [];
  if (intent === "add") {
    const [{ data: allPhotos }, { data: allSpreads }] = await Promise.all([
      supabase
        .from("photos")
        .select("id, upload_order, orientation, analysis")
        .eq("album_id", spread.album_id)
        .returns<
          Array<{
            id: string;
            upload_order: number;
            orientation: EnginePhoto["orientation"] | null;
            analysis: Record<string, unknown> | null;
          }>
        >(),
      supabase
        .from("spreads")
        .select("slots")
        .eq("album_id", spread.album_id)
        .returns<Array<{ slots: Record<string, string> }>>(),
    ]);
    const placedEverywhere = new Set(
      (allSpreads ?? []).flatMap((s) => Object.values(s.slots)),
    );
    const spreadStages = new Set(layoutPhotos.map((p) => p.stage));
    candidates = (allPhotos ?? [])
      .filter((p) => p.analysis && !placedEverywhere.has(p.id))
      .map((p) => {
        const a = p.analysis ?? {};
        return {
          id: p.id,
          upload_order: p.upload_order,
          orientation: p.orientation ?? "landscape",
          stage: String(a.stage ?? "other"),
          time_of_day: String(a.time_of_day ?? "unknown"),
          people: String(a.people ?? "none"),
          is_couple_portrait: Boolean(a.is_couple_portrait),
          emotion: String(a.emotion ?? "none"),
          shot_type: String(a.shot_type ?? "medium"),
          color_profile: String(a.color_profile ?? "color"),
          hero_potential: Number(a.hero_potential ?? 0),
          description: String(a.description ?? ""),
        } satisfies LayoutPhoto;
      })
      .sort(
        (a, b) =>
          Number(spreadStages.has(b.stage)) - Number(spreadStages.has(a.stage)) ||
          b.hero_potential - a.hero_potential,
      )
      .slice(0, 8);
    if (candidates.length === 0) {
      return NextResponse.json(
        { error: "Every photo is already in the album — nothing to add." },
        { status: 400 },
      );
    }
  }

  const universe: EnginePhoto[] = [
    ...layoutPhotos.map((p) => ({ id: p.id, orientation: p.orientation })),
    ...candidates.map((p) => ({ id: p.id, orientation: p.orientation })),
  ];

  const anthropic = createAnthropicClient();
  let proposal: {
    template_code: string;
    assignments: Array<{ slot_id: string; photo_id: string }>;
    note?: string;
  };
  try {
    const response = await anthropic.messages.create({
      model: LAYOUT_MODEL,
      max_tokens: 8000,
      thinking: { type: "adaptive" },
      system: SPREAD_REGEN_SYSTEM_PROMPT,
      output_config: {
        format: { type: "json_schema", schema: spreadRegenOutputSchema() },
      },
      messages: [
        {
          role: "user",
          content: spreadRegenUserMessage(layoutPhotos, spread.template_code, {
            intent,
            heroPhotoId: heroPhotoId ?? undefined,
            candidates,
          }),
        },
      ],
    });
    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      throw new Error(`No text in response (stop: ${response.stop_reason})`);
    }
    proposal = JSON.parse(textBlock.text);
  } catch (error) {
    console.error("Spread regen failed:", error);
    return NextResponse.json(
      { error: "The redesign hit a snag. Try again." },
      { status: 502 },
    );
  }

  const slots: Record<string, string> = {};
  for (const { slot_id, photo_id } of proposal.assignments) {
    slots[slot_id] = photo_id;
  }

  const validation = validateSpreadSlots(
    proposal.template_code,
    slots,
    universe, // current photos plus (for "add") the offered candidates
    new Set(),
  );
  // No empty slots ever; photo-count rules depend on the intent.
  const proposedTemplate = TEMPLATES_BY_CODE.get(proposal.template_code);
  const placedCount = Object.keys(slots).length;
  const fullyFilled = proposedTemplate?.slots.length === placedCount;
  const countOk =
    intent === "fewer"
      ? placedCount >= 1 && placedCount < photoIds.length
      : intent === "add"
        ? placedCount === photoIds.length + 1
        : intent === "calmer"
          ? placedCount >= 1 && placedCount <= photoIds.length
          : placedCount === photoIds.length;
  const heroOk =
    intent !== "hero" ||
    !heroPhotoId ||
    proposedTemplate?.slots.some(
      (s) => s.emphasis && slots[s.id] === heroPhotoId,
    ) === true;
  if (!validation.ok || !fullyFilled || !countOk || !heroOk) {
    return NextResponse.json(
      { error: "The redesign hit a snag. Try again." },
      { status: 502 },
    );
  }

  const { data: updatedRow, error: updateError } = await supabase
    .from("spreads")
    .update({
      template_code: proposal.template_code,
      slots: validation.slots,
      // A redesign starts clean: centered crops, unmirrored geometry.
      slot_crops: {},
      flipped: false,
      regen_count: spread.regen_count + 1,
    })
    .eq("id", spread.id)
    // Optimistic concurrency: a concurrent redesign already bumped the
    // counter, so this write matches zero rows instead of double-spending.
    .eq("regen_count", spread.regen_count)
    .select("id")
    .maybeSingle();
  if (updateError || !updatedRow) {
    return NextResponse.json({ error: "Could not save." }, { status: 500 });
  }

  // A photo the AI just placed is no longer "set aside" — clear its reason.
  const newlyPlaced = Object.values(validation.slots).filter(
    (pid) => !photoIds.includes(pid),
  );
  if (newlyPlaced.length > 0) {
    await supabase
      .from("photos")
      .update({ set_aside_reason: null })
      .in("id", newlyPlaced);
  }

  return NextResponse.json({
    ok: true,
    template_code: proposal.template_code,
    slots: validation.slots,
    regen_count: spread.regen_count + 1,
    note: typeof proposal.note === "string" ? proposal.note : null,
  });
}
