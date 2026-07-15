import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";

/**
 * Only same-origin, non-protocol-relative paths. `next` arrives from a URL, and
 * an unchecked redirect target is an open redirect — a phishing link that
 * genuinely originates from our domain.
 */
function safeNext(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return "/albums";
  return raw;
}

/**
 * Lands the couple's magic link. Exchanges the emailed token hash for a session
 * and drops them where they were headed.
 *
 * Verifying a token hash server-side (rather than exchanging a PKCE code) is what
 * lets a link requested on one device be opened on another.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = safeNext(searchParams.get("next"));

  if (!tokenHash || !type) {
    return NextResponse.redirect(new URL("/login?error=invalid", request.url));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });

  if (error) {
    // Expired or already used. Both mean "ask for a fresh one" to the couple.
    return NextResponse.redirect(new URL("/login?error=expired", request.url));
  }

  return NextResponse.redirect(new URL(next, request.url));
}
