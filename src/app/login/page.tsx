/* eslint-disable @next/next/no-img-element */
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
    <main className="relative flex flex-1 flex-col items-center justify-center bg-canvas px-6 py-16">
      <Link
        href="/"
        className="absolute left-6 top-6 sm:left-10"
        aria-label="Unbound — home"
      >
        <img src="/unbound-wordmark-ink.png" alt="Unbound" className="h-3.5 w-auto" />
      </Link>

      <div className="w-full max-w-sm rounded-xl border border-line bg-neutral-0 p-8 shadow-sm">
        <div className="flex flex-col gap-2 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-heading">
            Sign in
          </h1>
          <p className="text-sm text-muted">
            No password. We&rsquo;ll email you a link — new here, the same link
            signs you up.
          </p>
        </div>

        <div className="mt-8">
          <LoginForm linkError={error ? LINK_ERRORS[error] : undefined} />
        </div>
      </div>
    </main>
  );
}
