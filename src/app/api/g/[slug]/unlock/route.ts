import { NextResponse, type NextRequest } from "next/server";

import {
  GALLERY_ACCESS_COOKIE,
  makeAccessToken,
  verifyGalleryPassword,
} from "@/lib/galleries/access";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

/** Client-side gallery unlock: slug capability + password → HMAC cookie.
 * Admin client by design — visitors have no Supabase session; the slug and
 * password ARE the credentials. */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const body = await request.json().catch(() => null);
  const password = typeof body?.password === "string" ? body.password : "";

  const admin = createAdminClient();
  const { data: gallery } = await admin
    .from("galleries")
    .select("id, password_hash, expires_at")
    .eq("slug", slug)
    .maybeSingle<{ id: string; password_hash: string | null; expires_at: string | null }>();

  // Wrong slug and wrong password answer identically.
  if (
    !gallery ||
    (gallery.expires_at && new Date(gallery.expires_at) < new Date()) ||
    !gallery.password_hash ||
    !verifyGalleryPassword(password, gallery.password_hash)
  ) {
    return NextResponse.json(
      { error: "That's not the password. Ask your photographer." },
      { status: 401 },
    );
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    name: GALLERY_ACCESS_COOKIE(gallery.id),
    value: makeAccessToken(gallery.id),
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: `/g/${slug}`,
    maxAge: 30 * 24 * 60 * 60,
  });
  return response;
}
