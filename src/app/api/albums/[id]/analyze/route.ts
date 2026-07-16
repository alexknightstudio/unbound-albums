import { NextResponse, type NextRequest } from "next/server";
import sharp from "sharp";

import {
  matchResultsToBatch,
  needsCorrection,
  toStoredAnalysis,
} from "@/lib/ai/analysis";
import { createAnthropicClient } from "@/lib/ai/client";
import {
  ANALYSIS_BATCH_SIZE,
  ANALYSIS_MODEL,
  ANALYSIS_SYSTEM_PROMPT,
  analysisOutputSchema,
  type PhotoAnalysisResult,
} from "@/lib/ai/prompts/analysis";
import { THUMB_LONG_EDGE, THUMB_QUALITY } from "@/lib/photos/thumbnails";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

// One vision call over 10 images, plus storage reads. The slowest observed
// batches run well under this; the ceiling is for the outliers.
export const maxDuration = 300;

type AlbumRow = { id: string; status: string };
type PhotoRow = {
  id: string;
  storage_path: string;
  thumb_path: string | null;
};

/**
 * Analyzes ONE batch of photos and returns progress.
 *
 * The client calls this in a loop until { done: true }. One batch per
 * invocation keeps every request comfortably inside serverless limits, makes
 * progress naturally observable, and means a failure loses one batch, not the
 * whole run. Analysis is written once and never recomputed — the cost
 * guardrail lives in the "analysis is null" filter below.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  // The couple's own client first: RLS decides whether this album is theirs.
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

  if (album.status !== "uploading" && album.status !== "analyzing") {
    return NextResponse.json(
      { error: "This album has already been analyzed." },
      { status: 409 },
    );
  }

  const { count: total } = await supabase
    .from("photos")
    .select("id", { count: "exact", head: true })
    .eq("album_id", album.id);

  if (!total) {
    return NextResponse.json(
      { error: "Upload photos first." },
      { status: 400 },
    );
  }

  // First call kicks the status machine. The database trigger enforces
  // legality and logs the actor; this client carries the couple's identity.
  if (album.status === "uploading") {
    const { error: statusError } = await supabase
      .from("albums")
      .update({ status: "analyzing" })
      .eq("id", album.id);
    if (statusError) {
      return NextResponse.json(
        { error: "Could not start the analysis." },
        { status: 500 },
      );
    }
  }

  // Cached forever: only photos never analyzed are eligible.
  const { data: batch } = await supabase
    .from("photos")
    .select("id, storage_path, thumb_path")
    .eq("album_id", album.id)
    .is("analysis", null)
    .order("upload_order", { ascending: true })
    .limit(ANALYSIS_BATCH_SIZE)
    .returns<PhotoRow[]>();

  const { count: analyzedBefore } = await supabase
    .from("photos")
    .select("id", { count: "exact", head: true })
    .eq("album_id", album.id)
    .not("analysis", "is", null);

  if (!batch || batch.length === 0) {
    return NextResponse.json({
      done: true,
      analyzed: analyzedBefore ?? total,
      total,
    });
  }

  const admin = createAdminClient();

  // Analysis reads the 600px thumbnails — plenty for composition, emotion,
  // and color judgment, and roughly 1/100th the tokens of a 60MP original.
  const images: Array<{ photo: PhotoRow; jpeg: Buffer }> = [];
  for (const photo of batch) {
    const jpeg = await loadAnalysisJpeg(admin, photo);
    if (jpeg) images.push({ photo, jpeg });
  }

  if (images.length === 0) {
    return NextResponse.json(
      { error: "Those photos couldn't be read." },
      { status: 502 },
    );
  }

  // Interleave "Photo N:" labels with the images so the model's `index`
  // field is anchored to something explicit, not to counting.
  const content: Array<
    | { type: "text"; text: string }
    | {
        type: "image";
        source: { type: "base64"; media_type: "image/jpeg"; data: string };
      }
  > = [];
  images.forEach(({ jpeg }, i) => {
    content.push({ type: "text", text: `Photo ${i + 1}:` });
    content.push({
      type: "image",
      source: {
        type: "base64",
        media_type: "image/jpeg",
        data: jpeg.toString("base64"),
      },
    });
  });
  content.push({
    type: "text",
    text: `Analyze all ${images.length} photos above.`,
  });

  const anthropic = createAnthropicClient();

  let results: PhotoAnalysisResult[];
  try {
    const response = await anthropic.messages.create({
      model: ANALYSIS_MODEL,
      max_tokens: 16000,
      thinking: { type: "adaptive" },
      system: ANALYSIS_SYSTEM_PROMPT,
      output_config: {
        format: {
          type: "json_schema",
          schema: analysisOutputSchema(images.length),
        },
      },
      messages: [{ role: "user", content }],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      throw new Error(`No text in response (stop: ${response.stop_reason})`);
    }
    results = (JSON.parse(textBlock.text) as { photos: PhotoAnalysisResult[] })
      .photos;
  } catch (error) {
    console.error("Analysis call failed:", error);
    return NextResponse.json(
      { error: "The analysis hit a snag. Try again." },
      { status: 502 },
    );
  }

  const analyzedAt = new Date().toISOString();
  const matched = matchResultsToBatch(
    images.map((i) => i.photo),
    results,
  );

  let written = 0;
  for (const { photo, result } of matched) {
    const { error: writeError } = await admin
      .from("photos")
      .update({
        analysis: toStoredAnalysis(result, analyzedAt),
        needs_correction: needsCorrection(result),
      })
      .eq("id", photo.id)
      .is("analysis", null); // never overwrite — cached forever
    if (!writeError) written += 1;
  }

  if (written === 0) {
    // The model answered but nothing matched — surface it rather than letting
    // the client loop on a batch that will never shrink.
    return NextResponse.json(
      { error: "The analysis hit a snag. Try again." },
      { status: 502 },
    );
  }

  const analyzed = (analyzedBefore ?? 0) + written;
  return NextResponse.json({
    done: analyzed >= total,
    analyzed,
    total,
  });
}

/**
 * The JPEG the model sees: the stored thumbnail, or — for the rare photo
 * whose fire-and-forget thumbnail never landed — a fresh in-memory downscale
 * of the original.
 */
async function loadAnalysisJpeg(
  admin: ReturnType<typeof createAdminClient>,
  photo: PhotoRow,
): Promise<Buffer | null> {
  if (photo.thumb_path) {
    const { data } = await admin.storage.from("thumbs").download(photo.thumb_path);
    if (data) return Buffer.from(await data.arrayBuffer());
  }

  const { data: original } = await admin.storage
    .from("originals")
    .download(photo.storage_path);
  if (!original) return null;

  try {
    return await sharp(Buffer.from(await original.arrayBuffer()))
      .rotate()
      .resize(THUMB_LONG_EDGE, THUMB_LONG_EDGE, {
        fit: "inside",
        withoutEnlargement: true,
      })
      .jpeg({ quality: THUMB_QUALITY })
      .toBuffer();
  } catch {
    return null;
  }
}
