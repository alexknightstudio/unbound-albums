import { NextResponse, type NextRequest } from "next/server";

import { signedGetUrl } from "@/lib/galleries/r2";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

/**
 * Public image URLs (PLATFORM_SPEC P1). Signed R2 URLs expire, so public and
 * unlisted pages embed stable /i/{photoId} URLs instead; this route re-checks
 * visibility on every request and 302s to a fresh short-TTL signed URL.
 * Private gallery photos are NEVER served here — their pages get per-request
 * signed URLs behind the password/cookie check. Replaced by Cloudflare Images
 * transform URLs in P2; the URL shape survives that swap.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ photoId: string }> },
) {
  const { photoId } = await params;
  const wantFull = request.nextUrl.searchParams.get("full") === "1";

  const admin = createAdminClient();
  const { data: photo } = await admin
    .from("gallery_photos")
    .select("r2_key, thumb_key, gallery_id")
    .eq("id", photoId)
    .maybeSingle<{ r2_key: string; thumb_key: string | null; gallery_id: string }>();
  if (!photo) return new NextResponse(null, { status: 404 });

  const { data: gallery } = await admin
    .from("galleries")
    .select("visibility, expires_at")
    .eq("id", photo.gallery_id)
    .maybeSingle<{ visibility: string; expires_at: string | null }>();
  if (
    !gallery ||
    gallery.visibility === "private" ||
    (gallery.expires_at && new Date(gallery.expires_at) < new Date())
  ) {
    // Private answers exactly like absent.
    return new NextResponse(null, { status: 404 });
  }

  const key = wantFull ? photo.r2_key : (photo.thumb_key ?? photo.r2_key);
  const url = await signedGetUrl(key, 60 * 60);

  return NextResponse.redirect(url, {
    status: 302,
    headers: {
      // The redirect itself may be CDN-cached briefly; the signed target
      // outlives the cache window by far.
      "Cache-Control": "public, max-age=300, s-maxage=300",
    },
  });
}
