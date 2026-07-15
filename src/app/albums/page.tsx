import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

import { signOut } from "./actions";

export default async function AlbumsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // proxy.ts already gates this route. Re-checking here means a proxy
  // misconfiguration can't quietly turn into a data leak.
  if (!user) redirect("/login");

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 px-6 py-16 text-center">
      <h1 className="font-display text-5xl text-parchment">Create your album.</h1>
      <p className="max-w-sm text-sm text-pewter">
        Signed in as {user.email}.
      </p>

      <form action={signOut}>
        <button
          type="submit"
          className="rounded-md border border-stone px-5 py-2.5 text-sm text-pewter transition-colors hover:border-pewter hover:text-parchment"
        >
          Sign out
        </button>
      </form>
    </main>
  );
}
