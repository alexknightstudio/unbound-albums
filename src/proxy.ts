import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/supabase/env";

/** Prefixes that require a signed-in couple. */
const PROTECTED = ["/albums"];

/**
 * Runs before every page render: refreshes the auth session and writes the
 * rotated tokens back onto the response, then gates private routes.
 *
 * In Next.js 16 this file is `proxy.ts` — the old `middleware.ts` convention is
 * deprecated. Most Supabase guides still say middleware; they're out of date.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(SUPABASE_URL(), SUPABASE_ANON_KEY(), {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
        // No-store headers from the library. Without these a CDN can cache a
        // response carrying someone's Set-Cookie and hand their session to the
        // next visitor.
        for (const [key, value] of Object.entries(headers)) {
          response.headers.set(key, value);
        }
      },
    },
  });

  // Must be awaited before the response is generated — a refresh that lands
  // after the response is committed can't write its cookies and gets lost.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const needsAuth = PROTECTED.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );

  if (needsAuth && !user) {
    // No "next" round-trip: /albums is the only protected route in Phase 1, and
    // the magic-link template can't carry a query string through cleanly. Revisit
    // when there are deeper protected pages to return to.
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }

  if (user && pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/albums";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    // Everything except static assets and image files. Without this the auth
    // check would run on CSS and images too.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico)$).*)",
  ],
};
