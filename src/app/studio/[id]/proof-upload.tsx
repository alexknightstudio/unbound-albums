"use client";

import { useRef, useState, useTransition } from "react";

import { createClient } from "@/lib/supabase/client";

import { deliverProof, type DeliverState } from "./actions";

/**
 * The designer's delivery box. Finished spread images (exported from
 * SmartAlbums / Fundy / InDesign) go straight to storage from the browser,
 * sorted by filename — name them 01.jpg … 15.jpg and the page order is the
 * file order. Then one action turns them into a proof round.
 */
export function ProofUpload({
  albumId,
  nextRound,
  expectedPages,
}: {
  albumId: string;
  nextRound: number;
  expectedPages: number;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [note, setNote] = useState("");
  const [progress, setProgress] = useState<string | null>(null);
  const [result, setResult] = useState<DeliverState>({ status: "idle" });
  const [pending, startTransition] = useTransition();

  function pick(list: FileList | null) {
    if (!list) return;
    const sorted = [...list].sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { numeric: true }),
    );
    setFiles(sorted);
    setResult({ status: "idle" });
  }

  function deliver() {
    startTransition(async () => {
      const supabase = createClient();
      const paths: string[] = [];
      for (let i = 0; i < files.length; i++) {
        setProgress(`Uploading ${i + 1} of ${files.length}.`);
        const file = files[i];
        const ext = file.name.toLowerCase().endsWith(".png") ? "png" : "jpg";
        const path = `${albumId}/r${nextRound}/${String(i + 1).padStart(2, "0")}.${ext}`;
        const { error } = await supabase.storage
          .from("proofs")
          .upload(path, file, { upsert: true, contentType: file.type });
        if (error) {
          setProgress(null);
          setResult({
            status: "error",
            message: `Upload failed on ${file.name}. ${error.message}`,
          });
          return;
        }
        paths.push(path);
      }
      setProgress("Delivering.");
      const delivered = await deliverProof(albumId, paths, note);
      setProgress(null);
      setResult(delivered);
      if (delivered.status === "idle") {
        setFiles([]);
        setNote("");
      }
    });
  }

  return (
    <section className="flex flex-col gap-5 rounded-md border border-stone p-6">
      <div className="flex flex-col gap-1">
        <h2 className="font-display text-2xl text-parchment">
          Deliver round {nextRound}.
        </h2>
        <p className="text-xs leading-relaxed text-slate">
          Full-spread JPEGs in page order — name them 01–{String(expectedPages).padStart(2, "0")}
          {" "}and the file order is the page order.
        </p>
      </div>

      <input
        ref={inputRef}
        type="file"
        multiple
        accept="image/jpeg,image/png"
        className="sr-only"
        onChange={(event) => pick(event.target.files)}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={pending}
        className="self-start rounded-md border border-stone px-5 py-2.5 text-sm text-pewter transition-colors hover:border-pewter hover:text-parchment disabled:opacity-50"
      >
        {files.length > 0
          ? `${files.length} spreads chosen`
          : "Choose spread images"}
      </button>

      {files.length > 0 ? (
        <ol className="flex flex-col gap-1">
          {files.map((file, i) => (
            <li key={file.name} className="text-xs text-slate">
              {i + 1}. {file.name}
            </li>
          ))}
        </ol>
      ) : null}

      <div className="flex flex-col gap-2">
        <label htmlFor="proof-note" className="text-xs uppercase tracking-[0.3em] text-slate">
          A note to the couple
        </label>
        <textarea
          id="proof-note"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          rows={3}
          maxLength={2000}
          placeholder="What you led with, and why."
          className="w-full rounded-md border border-stone bg-charcoal px-4 py-3 text-sm text-parchment placeholder:text-slate focus:border-pewter focus:outline-none"
        />
      </div>

      <button
        type="button"
        onClick={deliver}
        disabled={pending || files.length === 0}
        className="self-start rounded-md bg-parchment px-6 py-3 text-sm text-ink transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {pending ? (progress ?? "Working.") : "Send the proof to the couple"}
      </button>

      {result.status === "error" ? (
        <p role="alert" className="text-sm text-pewter">
          {result.message}
        </p>
      ) : null}
    </section>
  );
}
