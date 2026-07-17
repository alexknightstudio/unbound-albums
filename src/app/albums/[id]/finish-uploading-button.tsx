"use client";

import { useState, useTransition } from "react";

import { finishUploading, type ActionState } from "./actions";

/** "That's everything." Closes the upload and opens the style brief. */
export function FinishUploadingButton({
  albumId,
  photoCount,
}: {
  albumId: string;
  photoCount: number;
}) {
  const [result, setResult] = useState<ActionState>({ status: "idle" });
  const [pending, startTransition] = useTransition();

  if (photoCount < 1) return null;

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setResult(await finishUploading(albumId));
          })
        }
        className="self-start rounded-md bg-parchment px-6 py-3.5 text-sm text-ink transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {pending ? "One moment." : "That's everything — tell us the look"}
      </button>
      {result.status === "error" ? (
        <p role="alert" className="text-sm text-pewter">
          {result.message}
        </p>
      ) : null}
    </div>
  );
}
