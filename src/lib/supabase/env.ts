/**
 * Environment access for Supabase.
 *
 * The values below MUST be written as literal `process.env.NEXT_PUBLIC_FOO`
 * references. Next.js inlines these into the client bundle by scanning the source
 * for exactly that shape — a computed lookup like `process.env[name]` is invisible
 * to it and evaluates to `undefined` in the browser while working fine on the
 * server. That asymmetry is miserable to debug, so don't refactor these into a
 * loop or a map.
 */

function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `Missing environment variable ${name}. ` +
        `Set it in .env.local for local development, and in the Vercel project settings for deploys.`,
    );
  }
  return value;
}

export const SUPABASE_URL = () =>
  required("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL);

export const SUPABASE_ANON_KEY = () =>
  required(
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
