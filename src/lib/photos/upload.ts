import * as tus from "tus-js-client";

import { createClient } from "@/lib/supabase/client";
import { SUPABASE_URL } from "@/lib/supabase/env";

import {
  UPLOAD_CONCURRENCY,
  UPLOAD_MAX_RETRIES,
} from "./limits";

/**
 * Supabase's resumable endpoint requires exactly 6MB chunks for every part but
 * the last. This is not a tuning knob — a different value fails the upload.
 * https://supabase.com/docs/guides/storage/uploads/resumable-uploads
 */
const CHUNK_SIZE = 6 * 1024 * 1024;

export const ORIGINALS_BUCKET = "originals";

export type UploadStatus =
  | "queued"
  | "uploading"
  | "done"
  | "failed"
  | "cancelled";

export type UploadItem = {
  /** Stable across retries; also the photo's id and its filename in storage. */
  id: string;
  file: File;
  status: UploadStatus;
  /** 0–100. */
  progress: number;
  error?: string;
  attempts: number;
};

/** Preserves the real extension so storage paths stay recognisable. */
function extensionFor(file: File): string {
  const match = file.name.toLowerCase().match(/\.([a-z0-9]+)$/);
  return match ? match[1] : "jpg";
}

export function storagePathFor(albumId: string, item: UploadItem): string {
  // {album_id}/{photo_id}.{ext} — the leading folder is the ownership key every
  // storage RLS policy checks. Changing this shape breaks those policies.
  return `${albumId}/${item.id}.${extensionFor(item.file)}`;
}

/**
 * Uploads one file, resumably. Resolves on success, rejects on failure.
 *
 * tus-js-client retries network blips on its own; the retry loop above this
 * handles the harder failures (a tunnel, a dead cell, a token that expired
 * mid-upload).
 */
function uploadOne({
  file,
  path,
  accessToken,
  supabaseUrl,
  onProgress,
  signal,
}: {
  file: File;
  path: string;
  accessToken: string;
  supabaseUrl: string;
  onProgress: (percent: number) => void;
  signal: AbortSignal;
}): Promise<void> {
  return new Promise((resolve, reject) => {
    const upload = new tus.Upload(file, {
      endpoint: `${supabaseUrl}/storage/v1/upload/resumable`,
      retryDelays: [0, 1000, 3000, 6000, 12000],
      headers: {
        authorization: `Bearer ${accessToken}`,
        // Lets a retry overwrite a half-written object instead of colliding.
        "x-upsert": "true",
      },
      uploadDataDuringCreation: true,
      // Keyed by album+photo id, so resuming after a reload finds the same
      // upload rather than starting a second one.
      removeFingerprintOnSuccess: true,
      metadata: {
        bucketName: ORIGINALS_BUCKET,
        objectName: path,
        contentType: file.type || "application/octet-stream",
        cacheControl: "3600",
      },
      chunkSize: CHUNK_SIZE,
      onError: reject,
      onProgress: (sent, total) => {
        onProgress(total > 0 ? Math.round((sent / total) * 100) : 0);
      },
      onSuccess: () => resolve(),
    });

    signal.addEventListener(
      "abort",
      () => {
        void upload.abort();
        reject(new DOMException("Upload cancelled", "AbortError"));
      },
      { once: true },
    );

    // Resume a previous attempt for this exact file if one is on record.
    void upload.findPreviousUploads().then((previous) => {
      if (previous.length > 0) upload.resumeFromPreviousUpload(previous[0]);
      upload.start();
    });
  });
}

export type UploadRunnerCallbacks = {
  onItemChange: (item: UploadItem) => void;
};

/**
 * Runs a queue of uploads at a fixed concurrency, retrying each file a few times
 * before giving up on it.
 *
 * One file failing never stops the others — a couple who loses photo 84 to a
 * dead cell should still get the other 149. Failures surface per-file so they
 * can be retried individually.
 */
export async function runUploads({
  albumId,
  items,
  startOrder,
  signal,
  onItemChange,
}: {
  albumId: string;
  items: UploadItem[];
  /**
   * How many photos the album already has. Without it a second batch would
   * restart upload_order at 0 and collide with the first.
   */
  startOrder: number;
  signal: AbortSignal;
} & UploadRunnerCallbacks): Promise<void> {
  const supabase = createClient();
  const supabaseUrl = SUPABASE_URL();
  const queue = [...items];

  async function worker() {
    while (queue.length > 0 && !signal.aborted) {
      const item = queue.shift();
      if (!item) return;

      const path = storagePathFor(albumId, item);
      let lastError = "";

      for (let attempt = 1; attempt <= UPLOAD_MAX_RETRIES; attempt++) {
        if (signal.aborted) return;

        item.status = "uploading";
        item.attempts = attempt;
        item.error = undefined;
        onItemChange({ ...item });

        try {
          // Fetched per attempt, not once up front: 150 photos on a slow
          // connection can outlast an access token, and a stale one fails every
          // remaining upload with an unhelpful 401.
          const {
            data: { session },
          } = await supabase.auth.getSession();

          if (!session) throw new Error("Your session expired. Sign in again.");

          await uploadOne({
            file: item.file,
            path,
            accessToken: session.access_token,
            supabaseUrl,
            signal,
            onProgress: (percent) => {
              item.progress = percent;
              onItemChange({ ...item });
            },
          });

          // The row is written only after the bytes land, so a photos row always
          // has a real file behind it. A failed upload leaves an orphaned object
          // at worst, which is cheap; an orphaned row would be a broken photo in
          // the album.
          const { error } = await supabase.from("photos").insert({
            id: item.id,
            album_id: albumId,
            storage_path: path,
            upload_order: startOrder + items.indexOf(item),
          });

          if (error) throw new Error(error.message);

          // Not awaited and not fatal. The photo is safely stored; a thumbnail
          // is a convenience we can regenerate later. Blocking the queue on it
          // would make a slow thumbnail look like a slow upload, and failing the
          // upload over it would throw away a photo we already have.
          void fetch(`/api/photos/${item.id}/thumbnail`, { method: "POST" });

          item.status = "done";
          item.progress = 100;
          onItemChange({ ...item });
          break;
        } catch (error) {
          if (signal.aborted || (error as Error)?.name === "AbortError") {
            item.status = "cancelled";
            onItemChange({ ...item });
            return;
          }

          lastError =
            error instanceof Error ? error.message : "Something went wrong.";

          if (attempt === UPLOAD_MAX_RETRIES) {
            item.status = "failed";
            item.error = lastError;
            onItemChange({ ...item });
          }
        }
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(UPLOAD_CONCURRENCY, items.length) }, worker),
  );
}
