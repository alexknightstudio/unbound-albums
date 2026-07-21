/* eslint-disable @next/next/no-img-element */
import Link from "next/link";

import { signOut } from "@/app/galleries/actions";

/** The signed-in chrome — tokens v1. One bar, no mystery. */
export function AppNav({ email }: { email: string }) {
  const initials = email.slice(0, 2).toUpperCase();
  return (
    <nav className="border-b border-line bg-neutral-0">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <div className="flex items-center gap-8">
          <Link href="/" aria-label="Unbound — home" className="flex items-center">
            <img src="/unbound-wordmark-ink.png" alt="Unbound" className="block h-3 w-auto" />
          </Link>
          <div className="flex items-center gap-1">
            <Link
              href="/galleries"
              className="rounded-md bg-accent-soft px-3 py-1.5 text-sm font-medium text-accent"
            >
              Galleries
            </Link>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <span
            title={email}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-accent-soft text-xs font-semibold text-accent"
          >
            {initials}
          </span>
          <form action={signOut}>
            <button
              type="submit"
              className="text-sm font-medium text-muted transition-colors hover:text-heading"
            >
              Sign out
            </button>
          </form>
        </div>
      </div>
    </nav>
  );
}
