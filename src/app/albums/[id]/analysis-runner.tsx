"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

type Progress = { done: boolean; analyzed: number; total: number };
type Phase = "idle" | "reading" | "designing";

/**
 * Drives the two AI passes: analysis (one POST per 10-photo batch, looped)
 * then layout generation (one POST). Every step is resumable — analysis is
 * cached per photo and generation persists nothing until a plan validates,
 * so a dropped connection or closed laptop just picks up where it stopped.
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
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState<Progress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const cancelled = useRef(false);

  const fail = useCallback((message: string) => {
    setError(message);
    setPhase("idle");
  }, []);

  const runGenerate = useCallback(async () => {
    setPhase("designing");
    let response: Response;
    try {
      response = await fetch(`/api/albums/${albumId}/generate`, {
        method: "POST",
      });
    } catch {
      fail("Connection lost. Your progress is saved.");
      return;
    }
    const body = await response.json().catch(() => null);
    if (!response.ok) {
      fail(body?.error ?? "Something went wrong. Try again.");
      return;
    }
    // Album is ready — reload the page with the finished plan.
    router.refresh();
  }, [albumId, fail, router]);

  const runLoop = useCallback(async () => {
    setError(null);
    setPhase("reading");

    while (!cancelled.current) {
      let response: Response;
      try {
        response = await fetch(`/api/albums/${albumId}/analyze`, {
          method: "POST",
        });
      } catch {
        fail("Connection lost. Your progress is saved.");
        return;
      }

      const body = await response.json().catch(() => null);

      if (!response.ok) {
        fail(body?.error ?? "Something went wrong. Try again.");
        return;
      }

      setProgress(body);

      if (body.done) {
        await runGenerate();
        return;
      }
    }
  }, [albumId, fail, runGenerate]);

  // An album already mid-flight resumes on page load without a click.
  useEffect(() => {
    cancelled.current = false;
    // Deferred a tick so the resume doesn't set state synchronously inside
    // the effect (React flags that as a cascading-render risk).
    let timer: ReturnType<typeof setTimeout> | undefined;
    if (albumStatus === "analyzing") {
      timer = setTimeout(() => void runLoop(), 0);
    } else if (albumStatus === "generating") {
      timer = setTimeout(() => void runGenerate(), 0);
    }
    return () => {
      cancelled.current = true;
      if (timer !== undefined) clearTimeout(timer);
    };
    // Run once on mount — status changes arrive via router.refresh(), which
    // re-renders with fresh server data.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (photoCount === 0) return null;

  if (phase === "reading") {
    return (
      <div className="flex flex-col gap-4 rounded-md border border-stone px-6 py-8">
        <p className="font-display text-3xl text-parchment">
          Reading your photos.
        </p>
        <p className="text-sm text-pewter" aria-live="polite">
          {progress ? `${progress.analyzed} of ${progress.total}` : "Starting."}
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

  if (phase === "designing") {
    return (
      <div className="flex flex-col gap-2 rounded-md border border-stone px-6 py-8">
        <p className="font-display text-3xl text-parchment">
          Designing your album.
        </p>
        <p className="text-sm text-pewter">
          Every photo read. Now the pages take shape.
        </p>
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
