"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  claimHandle,
  setGalleryVisibility,
  type GalleryActionState,
} from "../actions";

const OPTIONS = [
  {
    value: "private",
    label: "Private",
    hint: "Link holders only — add a password for a client gallery.",
  },
  {
    value: "unlisted",
    label: "Unlisted",
    hint: "Anyone with the link. Never in search engines.",
  },
  {
    value: "public",
    label: "Public",
    hint: "On your profile, indexed by Google. Your portfolio.",
  },
] as const;

export function VisibilityControl({
  galleryId,
  visibility,
  handle,
}: {
  galleryId: string;
  visibility: string;
  handle: string | null;
}) {
  const router = useRouter();
  const [current, setCurrent] = useState(visibility);
  const [handleInput, setHandleInput] = useState("");
  const [needsHandle, setNeedsHandle] = useState(false);
  const [result, setResult] = useState<GalleryActionState>({ status: "idle" });
  const [pending, startTransition] = useTransition();

  function apply(value: string) {
    setCurrent(value);
    if (value === "public" && !handle) {
      setNeedsHandle(true);
      return;
    }
    startTransition(async () => {
      const res = await setGalleryVisibility(galleryId, value);
      setResult(res);
      if (res.status === "idle") router.refresh();
    });
  }

  function claimAndPublish() {
    startTransition(async () => {
      const claimed = await claimHandle(handleInput);
      if (claimed.status === "error") {
        setResult(claimed);
        return;
      }
      const res = await setGalleryVisibility(galleryId, "public");
      setResult(res);
      if (res.status === "idle") {
        setNeedsHandle(false);
        router.refresh();
      }
    });
  }

  return (
    <section className="rounded-xl border border-line bg-neutral-0 p-6 shadow-xs">
      <h2 className="text-lg font-semibold text-heading">Visibility</h2>
      <div className="mt-4 flex flex-col gap-2">
        {OPTIONS.map((option) => (
          <label
            key={option.value}
            className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3.5 transition-colors ${
              current === option.value
                ? "border-accent bg-accent-soft/60"
                : "border-line hover:bg-well"
            }`}
          >
            <input
              type="radio"
              name="visibility"
              value={option.value}
              checked={current === option.value}
              onChange={() => apply(option.value)}
              disabled={pending}
              className="mt-1 accent-[#2563EB]"
            />
            <span>
              <span className="block text-sm font-medium text-heading">
                {option.label}
              </span>
              <span className="block text-sm text-muted">{option.hint}</span>
            </span>
          </label>
        ))}
      </div>

      {needsHandle ? (
        <div className="mt-4 rounded-lg border border-accent-border bg-accent-soft/50 p-4">
          <p className="text-sm font-medium text-heading">
            Claim your @handle to publish.
          </p>
          <p className="mt-1 text-sm text-muted">
            Public galleries live on your profile page.
          </p>
          <div className="mt-3 flex gap-2">
            <div className="relative flex-1">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-faint">
                @
              </span>
              <input
                type="text"
                value={handleInput}
                onChange={(e) => setHandleInput(e.target.value)}
                placeholder="alexknight"
                maxLength={30}
                className="w-full rounded-md border border-line-strong bg-neutral-0 py-2 pl-8 pr-3 text-sm text-heading shadow-xs placeholder:text-faint focus:border-accent focus:outline-none"
              />
            </div>
            <button
              type="button"
              onClick={claimAndPublish}
              disabled={pending || handleInput.trim().length < 3}
              className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-neutral-0 transition-colors hover:bg-accent-hover disabled:opacity-50"
            >
              {pending ? "Saving…" : "Claim & publish"}
            </button>
          </div>
        </div>
      ) : null}

      {result.status === "error" ? (
        <p role="alert" className="mt-3 text-sm text-danger">
          {result.message}
        </p>
      ) : null}
    </section>
  );
}
