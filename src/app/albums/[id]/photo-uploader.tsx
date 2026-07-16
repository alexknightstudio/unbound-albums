"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import {
  checkFile,
  checkSelection,
  FILE_INPUT_ACCEPT,
  MAX_PHOTO_COUNT,
  TARGET_PHOTO_COUNT,
} from "@/lib/photos/limits";
import { runUploads, type UploadItem } from "@/lib/photos/upload";

type Props = {
  albumId: string;
  /** Photos already uploaded, so a second batch continues rather than restarts. */
  existingCount: number;
};

export function PhotoUploader({ albumId, existingCount }: Props) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const [items, setItems] = useState<UploadItem[]>([]);
  const [rejections, setRejections] = useState<string[]>([]);
  const [running, setRunning] = useState(false);
  const [dragging, setDragging] = useState(false);

  // Cancel in-flight uploads if the couple navigates away mid-run.
  useEffect(() => () => abortRef.current?.abort(), []);

  const done = items.filter((i) => i.status === "done").length;
  const failed = items.filter((i) => i.status === "failed").length;
  const total = items.length;

  // existingCount is the server's number and the only source of truth for how
  // many photos the album has. Local state describes the run in progress, never
  // the total.
  const inFlight = items.filter(
    (i) => i.status === "queued" || i.status === "uploading",
  ).length;

  const overallProgress = useMemo(() => {
    if (total === 0) return 0;
    const sum = items.reduce((acc, i) => acc + i.progress, 0);
    return Math.round(sum / total);
  }, [items, total]);

  const updateItem = useCallback((next: UploadItem) => {
    setItems((current) =>
      current.map((i) => (i.id === next.id ? { ...next } : i)),
    );
  }, []);

  const start = useCallback(
    async (queued: UploadItem[]) => {
      if (queued.length === 0) return;

      const controller = new AbortController();
      abortRef.current = controller;
      setRunning(true);

      try {
        await runUploads({
          albumId,
          items: queued,
          startOrder: existingCount,
          signal: controller.signal,
          onItemChange: updateItem,
        });
      } finally {
        setRunning(false);
        abortRef.current = null;
        // Pull the server's count rather than trusting ours.
        router.refresh();
      }
    },
    [albumId, existingCount, router, updateItem],
  );

  const addFiles = useCallback(
    (fileList: FileList | File[]) => {
      const incoming = Array.from(fileList);
      const problems: string[] = [];
      const usable: File[] = [];

      for (const file of incoming) {
        const check = checkFile(file);
        if (check.ok) usable.push(file);
        else problems.push(check.message);
      }

      // Count what's already stored plus what's still on its way up, so two
      // quick batches can't sail past the cap between refreshes.
      const selection = checkSelection(existingCount + inFlight, usable.length);

      if (selection.overflow > 0) {
        problems.push(
          selection.full
            ? `This album is full at ${MAX_PHOTO_COUNT} photos.`
            : `We took the first ${selection.accepted}. An album holds ${MAX_PHOTO_COUNT}.`,
        );
      }

      const queued: UploadItem[] = usable
        .slice(0, selection.accepted)
        .map((file) => ({
          id: crypto.randomUUID(),
          file,
          status: "queued",
          progress: 0,
          attempts: 0,
        }));

      setRejections(problems);
      if (queued.length === 0) return;

      setItems((current) => [...current, ...queued]);
      void start(queued);
    },
    [existingCount, inFlight, start],
  );

  const retryFailed = useCallback(() => {
    const again = items
      .filter((i) => i.status === "failed")
      .map((i) => ({ ...i, status: "queued" as const, progress: 0, error: undefined }));
    if (again.length === 0) return;
    setItems((current) =>
      current.map((i) => again.find((a) => a.id === i.id) ?? i),
    );
    void start(again);
  }, [items, start]);

  return (
    <div className="flex flex-col gap-6">
      <div
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          if (event.dataTransfer.files.length > 0) addFiles(event.dataTransfer.files);
        }}
        className={`flex flex-col items-center gap-4 rounded-md border border-dashed px-6 py-14 text-center transition-colors ${
          dragging ? "border-parchment bg-charcoal" : "border-stone"
        }`}
      >
        <p className="font-display text-3xl text-parchment">
          {existingCount > 0
            ? `${existingCount} ${existingCount === 1 ? "photo" : "photos"}.`
            : "Add your photos."}
        </p>
        <p className="max-w-xs text-sm text-pewter">
          Around {TARGET_PHOTO_COUNT} is the sweet spot. Pick the ones you love.
        </p>

        <input
          ref={inputRef}
          type="file"
          multiple
          accept={FILE_INPUT_ACCEPT}
          className="sr-only"
          onChange={(event) => {
            if (event.target.files) addFiles(event.target.files);
            // Lets the same file be re-picked after a failure.
            event.target.value = "";
          }}
        />

        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={running}
          className="mt-2 rounded-md bg-parchment px-6 py-3 text-sm text-ink transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {running ? "Uploading." : "Choose photos"}
        </button>
      </div>

      {total > 0 && (
        <div className="flex flex-col gap-4">
          <div className="flex items-baseline justify-between">
            <span className="text-sm text-pewter">
              {/* Counts finished, not "the one we're on" — several upload at once,
                  so there is no single current photo to name. */}
              {running
                ? `${done} of ${total} uploaded.`
                : failed > 0
                  ? `${done} uploaded. ${failed} didn${"’"}t make it.`
                  : `${done} uploaded.`}
            </span>
            <span className="text-xs text-slate">{overallProgress}%</span>
          </div>

          <div className="h-px w-full overflow-hidden bg-stone">
            <div
              className="h-px bg-parchment transition-[width] duration-300"
              style={{ width: `${overallProgress}%` }}
            />
          </div>

          <ul className="flex flex-col gap-px overflow-hidden rounded-md border border-stone">
            {items.map((item) => (
              <li
                key={item.id}
                className="flex items-center justify-between gap-4 bg-charcoal px-4 py-3"
              >
                <span className="min-w-0 flex-1 truncate text-xs text-pewter">
                  {item.file.name}
                </span>
                <span className="shrink-0 text-xs text-slate">
                  {item.status === "done" && "Done"}
                  {item.status === "queued" && "Waiting"}
                  {item.status === "uploading" && `${item.progress}%`}
                  {item.status === "cancelled" && "Stopped"}
                  {item.status === "failed" && (
                    <span title={item.error}>Failed</span>
                  )}
                </span>
              </li>
            ))}
          </ul>

          {failed > 0 && !running && (
            <button
              type="button"
              onClick={retryFailed}
              className="self-start rounded-md border border-stone px-4 py-2 text-xs text-pewter transition-colors hover:border-pewter hover:text-parchment"
            >
              Try those {failed} again
            </button>
          )}
        </div>
      )}

      {rejections.length > 0 && (
        <ul className="flex flex-col gap-1" role="alert">
          {rejections.map((message) => (
            <li key={message} className="text-xs text-slate">
              {message}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
