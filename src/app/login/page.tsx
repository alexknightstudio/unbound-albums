import Link from "next/link";

import { LoginForm } from "./login-form";

const LINK_ERRORS: Record<string, string> = {
  expired: "That link has expired or was already used. Here's a fresh one.",
  invalid: "That link didn't look right. Try again.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="relative flex flex-1 flex-col items-center justify-center px-6 py-16">
      <Link
        href="/"
        className="absolute left-6 top-6 text-xs tracking-[0.35em] text-parchment sm:left-10"
        aria-label="Unbound Albums home"
      >
        UNBOUND
      </Link>
      <div className="flex w-full max-w-sm flex-col gap-10">
        <div className="flex flex-col gap-3 text-center">
          <h1 className="font-display text-4xl text-parchment">Sign in</h1>
          <p className="text-sm text-pewter">
            No password. We&rsquo;ll email you a link.
          </p>
        </div>

        <LoginForm linkError={error ? LINK_ERRORS[error] : undefined} />
      </div>
    </main>
  );
}
