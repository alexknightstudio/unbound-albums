"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * The resumable gallery uploader (HOSTING_SPEC.md §5 — the switching bar).
 *
 * Files go to R2 in 10MB presigned parts, straight from the browser. A
 * manifest in localStorage remembers each file's uploadId and finished parts, so
 * a network drop, closed tab, or restarted laptop resumes where it left off —
 * re-picking the same files skips completed parts and completed files.
 * Three files in flight; parts sequential per file (simple, resumable).
 */

const CONCURRENT_FILES = 3;
const PART_RETRIES = 3;

type ManifestEntry = {
  photoId: string;
  key: string;
  uploadId: string;
  partSize: number;
  etags: Record<number, string>;
};

type ItemStatus = "queued" | "uploading" | "done" | "failed";
type Item = {
  id: string;
  file: File;
  status: ItemStatus;
  progress: number; // 0..1
  error?: string;
};

const fileKey = (f: File) => `${f.name}|${f.size}|${f.lastModified}`;

function loadManifest(galleryId: string): Record<string, ManifestEntry> {
  try {
    return JSON.parse(localStorage.getItem(`ub-upload-${galleryId}`) ?? "{}");
  } catch {
    return {};
  }
}

function saveManifest(galleryId: string, manifest: Record<string, ManifestEntry>) {
  localStorage.setItem(`ub-upload-${galleryId}`, JSON.stringify(manifest));
}

export function GalleryUploader({
  galleryId,
  existingFilenames,
}: {
  galleryId: string;
  /** Already-delivered filenames — re-picking a finished file is a no-op. */
  existingFilenames: readonly string[];
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [running, setRunning] = useState(false);
  const queueRef = useRef<Item[]>([]);
  const existing = useRef(new Set(existingFilenames));

  useEffect(() => {
    existing.current = new Set(existingFilenames);
  }, [existingFilenames]);

  const update = useCallback((id: string, patch: Partial<Item>) => {
    setItems((all) => all.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  }, []);

  const api = useCallback(
    async (payload: unknown) => {
      const res = await fetch(`/api/galleries/${galleryId}/uploads`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      return json;
    },
    [galleryId],
  );

  const uploadOne = useCallback(
    async (item: Item) => {
      const manifest = loadManifest(galleryId);
      const mKey = fileKey(item.file);
      let entry = manifest[mKey];

      if (!entry) {
        const created = await api({
          action: "create",
          filename: item.file.name,
          size: item.file.size,
          contentType: item.file.type,
        });
        entry = {
          photoId: created.photoId,
          key: created.key,
          uploadId: created.uploadId,
          partSize: created.partSize,
          etags: {},
        };
        manifest[mKey] = entry;
        saveManifest(galleryId, manifest);
      }

      const partCount = Math.max(1, Math.ceil(item.file.size / entry.partSize));
      const missing = Array.from({ length: partCount }, (_, i) => i + 1).filter(
        (n) => !entry.etags[n],
      );

      if (missing.length > 0) {
        const { urls } = await api({
          action: "sign-parts",
          key: entry.key,
          uploadId: entry.uploadId,
          partNumbers: missing,
        });
        const urlByPart = new Map<number, string>(
          urls.map((u: { partNumber: number; url: string }) => [u.partNumber, u.url]),
        );

        for (const partNumber of missing) {
          const start = (partNumber - 1) * entry.partSize;
          const blob = item.file.slice(start, start + entry.partSize);
          let lastError: unknown;
          for (let attempt = 1; attempt <= PART_RETRIES; attempt++) {
            try {
              const res = await fetch(urlByPart.get(partNumber)!, {
                method: "PUT",
                body: blob,
              });
              if (!res.ok) throw new Error(`part ${partNumber}: HTTP ${res.status}`);
              const etag = res.headers.get("etag");
              if (!etag) throw new Error(`part ${partNumber}: no ETag`);
              entry.etags[partNumber] = etag;
              saveManifest(galleryId, manifest);
              lastError = undefined;
              break;
            } catch (error) {
              lastError = error;
              await new Promise((r) => setTimeout(r, attempt * 1500));
            }
          }
          if (lastError) throw lastError;
          const doneParts = Object.keys(entry.etags).length;
          update(item.id, { progress: doneParts / partCount });
        }
      }

      await api({
        action: "complete",
        key: entry.key,
        uploadId: entry.uploadId,
        photoId: entry.photoId,
        filename: item.file.name,
        size: item.file.size,
        parts: Object.entries(entry.etags).map(([n, ETag]) => ({
          PartNumber: Number(n),
          ETag,
        })),
      });

      delete manifest[mKey];
      saveManifest(galleryId, manifest);
      update(item.id, { status: "done", progress: 1 });
    },
    [api, galleryId, update],
  );

  const drain = useCallback(async () => {
    setRunning(true);
    const workers = Array.from({ length: CONCURRENT_FILES }, async () => {
      for (;;) {
        const next = queueRef.current.shift();
        if (!next) return;
        update(next.id, { status: "uploading" });
        try {
          await uploadOne(next);
        } catch (error) {
          // A stale uploadId (aborted server-side) means start the file over
          // next run: drop the manifest entry so resume doesn't wedge.
          const message = error instanceof Error ? error.message : "Upload failed";
          if (/NoSuchUpload|no etag/i.test(message)) {
            const manifest = loadManifest(galleryId);
            delete manifest[fileKey(next.file)];
            saveManifest(galleryId, manifest);
          }
          update(next.id, { status: "failed", error: message });
        }
      }
    });
    await Promise.all(workers);
    setRunning(false);
    router.refresh();
  }, [galleryId, router, update, uploadOne]);

  const addFiles = useCallback(
    (list: FileList | File[]) => {
      const fresh: Item[] = [...list]
        .filter((f) => f.type === "image/jpeg" || f.type === "image/png")
        .filter((f) => !existing.current.has(f.name))
        .map((file) => ({
          id: crypto.randomUUID(),
          file,
          status: "queued" as const,
          progress: 0,
        }));
      if (fresh.length === 0) return;
      setItems((all) => [...all, ...fresh]);
      queueRef.current.push(...fresh);
      if (!running) void drain();
    },
    [drain, running],
  );

  const retryFailed = useCallback(() => {
    const failed = items.filter((i) => i.status === "failed");
    if (failed.length === 0) return;
    setItems((all) =>
      all.map((i) =>
        i.status === "failed" ? { ...i, status: "queued", error: undefined } : i,
      ),
    );
    queueRef.current.push(...failed.map((i) => ({ ...i, status: "queued" as const })));
    if (!running) void drain();
  }, [drain, items, running]);

  const done = items.filter((i) => i.status === "done").length;
  const failed = items.filter((i) => i.status === "failed").length;
  const overall =
    items.length === 0
      ? 0
      : items.reduce((acc, i) => acc + i.progress, 0) / items.length;

  return (
    <div className="flex flex-col gap-5">
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          if (e.dataTransfer.files.length > 0) addFiles(e.dataTransfer.files);
        }}
        className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-line-strong bg-neutral-0 px-6 py-10 text-center shadow-xs"
      >
        <p className="text-lg font-semibold text-heading">
          Drop the whole shoot.
        </p>
        <p className="max-w-sm text-sm text-muted">
          JPEGs, hundreds at a time. Uploads survive bad WiFi and closed tabs —
          re-pick the same files and they continue where they stopped.
        </p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/jpeg,image/png"
          className="sr-only"
          onChange={(e) => {
            if (e.target.files) addFiles(e.target.files);
            e.target.value = "";
          }}
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="mt-1 rounded-md bg-accent px-6 py-2.5 text-sm font-medium text-neutral-0 shadow-xs transition-colors hover:bg-accent-hover"
        >
          Choose photos
        </button>
      </div>

      {items.length > 0 ? (
        <div className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between">
            <span className="text-sm text-body">
              {running
                ? `${done} of ${items.length} delivered.`
                : failed > 0
                  ? `${done} delivered. ${failed} need another try.`
                  : `${done} delivered.`}
            </span>
            <span className="text-sm text-muted">{Math.round(overall * 100)}%</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-well">
            <div
              className="h-1.5 rounded-full bg-accent transition-[width] duration-300"
              style={{ width: `${overall * 100}%` }}
            />
          </div>
          {failed > 0 && !running ? (
            <button
              type="button"
              onClick={retryFailed}
              className="self-start rounded-md border border-line-strong bg-neutral-0 px-4 py-2 text-sm font-medium text-body shadow-xs transition-colors hover:bg-well"
            >
              Try those {failed} again
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
