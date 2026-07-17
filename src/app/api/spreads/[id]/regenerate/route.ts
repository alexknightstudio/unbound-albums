import { NextResponse, type NextRequest } from "next/server";

import { createAnthropicClient } from "@/lib/ai/client";
import {
  LAYOUT_MODEL,
  SPREAD_REGEN_SYSTEM_PROMPT,
  spreadRegenOutputSchema,
  spreadRegenUserMessage,
  type LayoutPhoto,
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
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

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

  const enginePhotos: EnginePhoto[] = layoutPhotos.map((p) => ({
    id: p.id,
    orientation: p.orientation,
  }));

  const anthropic = createAnthropicClient();
  let proposal: {
    template_code: string;
    assignments: Array<{ slot_id: string; photo_id: string }>;
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
          content: spreadRegenUserMessage(layoutPhotos, spread.template_code),
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
    enginePhotos,
    new Set(), // photos on this spread only; the rest of the album is untouched
  );
  // Every photo placed AND every slot filled — a redesign must not introduce
  // empty boxes, so the template's slot count has to match the photo count.
  const proposedTemplate = TEMPLATES_BY_CODE.get(proposal.template_code);
  const allPlaced =
    Object.keys(slots).length === photoIds.length &&
    proposedTemplate?.slots.length === photoIds.length;
  if (!validation.ok || !allPlaced) {
    return NextResponse.json(
      { error: "The redesign hit a snag. Try again." },
      { status: 502 },
    );
  }

  const { error: updateError } = await supabase
    .from("spreads")
    .update({
      template_code: proposal.template_code,
      slots: validation.slots,
      regen_count: spread.regen_count + 1,
    })
    .eq("id", spread.id);
  if (updateError) {
    return NextResponse.json({ error: "Could not save." }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    template_code: proposal.template_code,
    regen_count: spread.regen_count + 1,
  });
}
