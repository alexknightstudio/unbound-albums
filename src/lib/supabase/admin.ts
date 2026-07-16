import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import { SUPABASE_URL } from "./env";

/**
 * Service-role client. Bypasses RLS entirely.
 *
 * The "server-only" import above makes the build fail if this file is ever
 * imported from a Client Component — which would ship the service key to the
 * browser and hand every visitor full access to every couple's photos.
 *
 * Use this only where a couple legitimately cannot act for themselves: writing
 * to the thumbs bucket (read-only to them by design), the Stripe webhook, the
 * admin panel. Never as a shortcut around a policy that's merely inconvenient.
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error(
      "Missing environment variable SUPABASE_SERVICE_ROLE_KEY. " +
        "Set it in .env.local and in the Vercel project settings.",
    );
  }

  return createSupabaseClient(SUPABASE_URL(), key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
