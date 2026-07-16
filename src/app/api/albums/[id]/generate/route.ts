import { NextResponse, type NextRequest } from "next/server";

import { createAnthropicClient } from "@/lib/ai/client";
import {
  LAYOUT_MODEL,
  LAYOUT_SYSTEM_PROMPT,
  layoutOutputSchema,
  layoutUserMessage,
  type LayoutPhoto,
  type RawSpreadPlan,
} from "@/lib/ai/prompts/layout";
import {
  spreadTargetFor,
  validatePlan,
  type EnginePhoto,
  type ValidatedSpread,
} from "@/lib/engine/engine";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

// One layout call reasons over the whole album. Give it room.
export const maxDuration = 300;

type AlbumRow = { id: string; status: string };
type PhotoRow = {
  id: string;
  upload_order: number;
  orientation: "portrait" | "landscape" | "square" | null;
  analysis: Record<string, unknown> | null;
};

/**
 * Generates the album's spread plan from the (already cached) analysis.
 *
 * Called once after analysis completes. The model proposes; the engine
 * validates; only a plan that passes the full contract is persisted. One
 * validation failure earns one retry with the error list appended — a second
 * failure surfaces to the couple as "try again" without a row written.
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

  const { data: album } = await supabase
    .from("albums")
    .select("id, status")
    .eq("id", id)
    .maybeSingle<AlbumRow>();

  if (!album) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  // "analyzing" is the normal entry. "generating" means a previous attempt
  // was interrupted (closed laptop, failed call) — safe to run again, since
  // nothing is persisted until a plan validates.
  if (album.status !== "analyzing" && album.status !== "generating") {
    return NextResponse.json(
      { error: "This album already has its design." },
      { status: 409 },
    );
  }

  const { data: photos } = await supabase
    .from("photos")
    .select("id, upload_order, orientation, analysis")
    .eq("album_id", album.id)
    .order("upload_order", { ascending: true })
    .returns<PhotoRow[]>();

  if (!photos || photos.length === 0) {
    return NextResponse.json({ error: "No photos." }, { status: 400 });
  }

  const unanalyzed = photos.filter((p) => p.analysis === null);
  if (unanalyzed.length > 0) {
    return NextResponse.json(
      { error: "Analysis isn't finished yet." },
      { status: 409 },
    );
  }

  if (album.status === "analyzing") {
    const { error: statusError } = await supabase
      .from("albums")
      .update({ status: "generating" })
      .eq("id", album.id);
    if (statusError) {
      return NextResponse.json(
        { error: "Could not start the design." },
        { status: 500 },
      );
    }
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

  const targetSpreads = spreadTargetFor(photos.length);
  const anthropic = createAnthropicClient();

  let plan: RawSpreadPlan | null = null;
  let spreads: ValidatedSpread[] | null = null;
  let lastErrors: string[] = [];

  // One honest attempt, one repair attempt with the validator's error list.
  for (let attempt = 0; attempt < 2 && spreads === null; attempt++) {
    const messages: Array<{ role: "user"; content: string }> = [
      {
        role: "user",
        content: layoutUserMessage(layoutPhotos, targetSpreads),
      },
    ];
    if (attempt > 0) {
      messages[0].content += [
        "\n\nYour previous plan failed validation with these errors — fix every one:",
        ...lastErrors.map((e) => `- ${e}`),
      ].join("\n");
    }

    try {
      const response = await anthropic.messages.create({
        model: LAYOUT_MODEL,
        max_tokens: 16000,
        thinking: { type: "adaptive" },
        system: LAYOUT_SYSTEM_PROMPT,
        output_config: {
          format: { type: "json_schema", schema: layoutOutputSchema() },
        },
        messages,
      });

      const textBlock = response.content.find((b) => b.type === "text");
      if (!textBlock || textBlock.type !== "text") {
        throw new Error(`No text in response (stop: ${response.stop_reason})`);
      }
      plan = JSON.parse(textBlock.text) as RawSpreadPlan;
    } catch (error) {
      console.error("Layout call failed:", error);
      return NextResponse.json(
        { error: "The design hit a snag. Try again." },
        { status: 502 },
      );
    }

    const result = validatePlan(plan, enginePhotos);
    if (result.ok) {
      spreads = result.spreads;
    } else {
      lastErrors = result.errors;
      console.warn(
        `Layout plan attempt ${attempt + 1} failed validation:`,
        result.errors.slice(0, 10),
      );
    }
  }

  if (!spreads || !plan) {
    return NextResponse.json(
      { error: "The design hit a snag. Try again." },
      { status: 502 },
    );
  }

  const admin = createAdminClient();

  // Replace any partial previous attempt wholesale. Spreads are cheap rows;
  // a half-written plan is not a plan.
  const { error: clearError } = await admin
    .from("spreads")
    .delete()
    .eq("album_id", album.id);
  if (clearError) {
    return NextResponse.json({ error: "Could not save." }, { status: 500 });
  }

  const { error: insertError } = await admin.from("spreads").insert(
    spreads.map((s) => ({
      album_id: album.id,
      position: s.position,
      template_code: s.template_code,
      slots: s.slots,
    })),
  );
  if (insertError) {
    console.error("Spread insert failed:", insertError);
    return NextResponse.json({ error: "Could not save." }, { status: 500 });
  }

  // Set-aside reasons: clear all, then write the current plan's.
  await admin
    .from("photos")
    .update({ set_aside_reason: null })
    .eq("album_id", album.id);
  for (const { photo_id, reason } of plan.set_aside) {
    await admin
      .from("photos")
      .update({ set_aside_reason: reason })
      .eq("id", photo_id)
      .eq("album_id", album.id);
  }

  const { error: readyError } = await supabase
    .from("albums")
    .update({ status: "ready" })
    .eq("id", album.id);
  if (readyError) {
    // Spreads are saved; status is retryable by calling again.
    return NextResponse.json(
      { error: "Saved, but could not finish. Try again." },
      { status: 500 },
    );
  }

  return NextResponse.json({
    done: true,
    spreads: spreads.length,
    set_aside: plan.set_aside.length,
  });
}
