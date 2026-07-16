"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

type Progress = { done: boolean; analyzed: number; total: number };

/**
 * Drives the analysis loop: one POST per batch until the server says done.
 *
 * The server does one vision call per request, so a dropped connection or a
 * closed laptop loses at most one batch — reopening the page resumes exactly
 * where it left off, because analyzed photos are never re-analyzed.
 */
export function AnalysisRunner({
  albumId,
  albumStatus,
  photoCount,
}: {
  albumId: string;
  albumStatus: string;
  photoCount: number;
}) {
  const router = useRouter();
  const [running, setRunning] = useState(albumStatus === "analyzing");
  const [progress, setProgress] = useState<Progress | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Survives re-renders; stops the loop if the component unmounts.
  const cancelled = useRef(false);

  const runLoop = useCallback(async () => {
    setError(null);
    setRunning(true);

    while (!cancelled.current) {
      let response: Response;
      try {
        response = await fetch(`/api/albums/${albumId}/analyze`, {
          method: "POST",
        });
      } catch {
        setError("Connection lost. Your progress is saved.");
        setRunning(false);
        return;
      }

      const body = await response.json().catch(() => null);

      if (!response.ok) {
        setError(body?.error ?? "Something went wrong. Try again.");
        setRunning(false);
        return;
      }

      setProgress(body);

      if (body.done) {
        setRunning(false);
        router.refresh();
        return;
      }
    }
  }, [albumId, router]);

  // An album already mid-analysis resumes on page load without a click.
  useEffect(() => {
    cancelled.current = false;
    // Deferred a tick so the resume doesn't set state synchronously inside
    // the effect (React flags that as a cascading-render risk).
    const timer =
      albumStatus === "analyzing"
        ? setTimeout(() => void runLoop(), 0)
        : undefined;
    return () => {
      cancelled.current = true;
      if (timer !== undefined) clearTimeout(timer);
    };
    // Run once on mount — albumStatus changes arrive via router.refresh(),
    // which remounts with fresh server data.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (photoCount === 0) return null;

  const finished = progress?.done === true;

  if (finished) {
    return (
      <div className="flex flex-col gap-2 rounded-md border border-stone px-6 py-8 text-center">
        <p className="font-display text-3xl text-parchment">
          Every photo, read.
        </p>
        <p className="text-sm text-pewter">
          {progress.total} photos analyzed. Album design is next.
        </p>
      </div>
    );
  }

  if (running) {
    return (
      <div className="flex flex-col gap-4 rounded-md border border-stone px-6 py-8">
        <p className="font-display text-3xl text-parchment">
          Reading your photos.
        </p>
        <p className="text-sm text-pewter" aria-live="polite">
          {progress
            ? `${progress.analyzed} of ${progress.total}`
            : "Starting."}
        </p>
        <div className="h-px w-full overflow-hidden bg-stone">
          <div
            className="h-px bg-parchment transition-[width] duration-500"
            style={{
              width: progress
                ? `${Math.round((progress.analyzed / progress.total) * 100)}%`
                : "2%",
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        onClick={() => void runLoop()}
        className="rounded-md bg-parchment px-6 py-3 text-sm text-ink transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {error ? "Pick up where we left off" : "Design my album"}
      </button>
      <p className="text-xs text-slate">
        We read every photo — light, color, emotion — before designing a
        single page. A few minutes, once.
      </p>
      {error ? (
        <p className="text-xs text-pewter" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
