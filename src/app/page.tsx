import Link from "next/link";

import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Signed-in couples go straight to their albums; everyone else signs in.
  const href = user ? "/albums" : "/login";
  const label = user ? "Your albums" : "Sign in";

  return (
    <main className="flex-1 flex flex-col items-center justify-center gap-8 px-6 text-center">
      <div className="flex flex-col items-center gap-5">
        <h1 className="font-display text-5xl sm:text-6xl text-parchment">
          Your love story, <em>unbound.</em>
        </h1>
        <p className="text-pewter text-sm max-w-sm">
          Wedding albums, designed for you.
        </p>
      </div>

      <Link
        href={href}
        className="rounded-md bg-parchment px-6 py-3.5 text-sm text-ink transition-opacity hover:opacity-90"
      >
        {label}
      </Link>
    </main>
  );
}
