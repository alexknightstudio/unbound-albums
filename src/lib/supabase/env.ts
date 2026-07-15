/**
 * Fails loudly at the first call rather than letting `undefined` reach Supabase
 * and surface as an opaque "Invalid URL" three layers down. A missing env var on
 * a deploy should name itself.
 */
function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing environment variable ${name}. ` +
        `Set it in .env.local for local development, and in the Vercel project settings for deploys.`,
    );
  }
  return value;
}

export const SUPABASE_URL = () => required("NEXT_PUBLIC_SUPABASE_URL");
export const SUPABASE_ANON_KEY = () => required("NEXT_PUBLIC_SUPABASE_ANON_KEY");
