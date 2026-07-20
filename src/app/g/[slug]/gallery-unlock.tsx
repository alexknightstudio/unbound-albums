"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function GalleryUnlock({ slug }: { slug: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(event: React.FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      const res = await fetch(`/api/g/${slug}/unlock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        router.refresh();
      } else {
        const json = await res.json().catch(() => ({}));
        setError(json.error ?? "That didn't work. Try again.");
      }
    });
  }

  return (
    <form onSubmit={submit} className="flex w-full max-w-sm flex-col gap-4">
      <label
        htmlFor="gallery-password"
        className="text-xs font-medium uppercase tracking-[2.5px] text-pewter"
      >
        Gallery password
      </label>
      <input
        id="gallery-password"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
        autoFocus
        className="w-full rounded-md border border-stone bg-charcoal px-[18px] py-[15px] text-base text-parchment placeholder:text-slate focus:border-pewter focus:outline-none"
      />
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-parchment px-6 py-3.5 text-xs font-medium uppercase tracking-[2.5px] text-ink transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {pending ? "One moment." : "Open the gallery"}
      </button>
      {error ? (
        <p role="alert" className="text-sm text-pewter">
          {error}
        </p>
      ) : null}
    </form>
  );
}
