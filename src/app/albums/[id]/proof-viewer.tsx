"use client";

import { useState, useTransition } from "react";

import {
  approveProof,
  requestRevisions,
  type ActionState,
  type RevisionNoteInput,
} from "./actions";

export type ProofPageView = {
  position: number;
  url: string;
};

/**
 * The proof — the designer's delivered spreads, page pair by page pair.
 * In review mode the couple can pin a note to any page (or the whole album)
 * and send everything back in one move, or approve.
 */
export function ProofViewer({
  albumId,
  proofId,
  round,
  designerNote,
  pages,
  mode,
}: {
  albumId: string;
  proofId: string;
  round: number;
  designerNote: string | null;
  pages: ProofPageView[];
  mode: "review" | "readonly";
}) {
  const [reviewing, setReviewing] = useState(false);
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [albumNote, setAlbumNote] = useState("");
  const [result, setResult] = useState<ActionState>({ status: "idle" });
  const [pending, startTransition] = useTransition();

  const noteCount =
    Object.values(notes).filter((n) => n.trim().length > 0).length +
    (albumNote.trim().length > 0 ? 1 : 0);

  function send() {
    const payload: RevisionNoteInput[] = [
      ...Object.entries(notes)
        .map(([position, note]) => ({ position: Number(position), note }))
        .filter((n) => n.note.trim().length > 0),
      ...(albumNote.trim().length > 0
        ? [{ position: null, note: albumNote }]
        : []),
    ];
    startTransition(async () => {
      setResult(await requestRevisions(albumId, proofId, payload));
    });
  }

  function approve() {
    startTransition(async () => {
      setResult(await approveProof(albumId));
    });
  }

  return (
    <section className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <p className="text-xs uppercase tracking-[0.3em] text-slate">
          Proof — round {round}
        </p>
        {designerNote ? (
          <blockquote className="max-w-xl font-display text-xl italic leading-snug text-parchment">
            &ldquo;{designerNote}&rdquo;
            <cite className="mt-2 block text-xs not-italic text-slate">
              — your designer
            </cite>
          </blockquote>
        ) : null}
      </div>

      <div className="flex flex-col gap-10">
        {pages.map((page) => (
          <figure key={page.position} className="flex flex-col gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={page.url}
              alt={`Album pages ${page.position * 2 - 1} and ${page.position * 2}`}
              loading={page.position > 2 ? "lazy" : "eager"}
              className="w-full rounded-[3px] shadow-[0_1px_40px_rgba(0,0,0,0.55)]"
            />
            <figcaption className="flex items-baseline justify-between gap-4">
              <span className="text-xs tracking-widest text-slate">
                PAGES {page.position * 2 - 1}–{page.position * 2}
              </span>
              {reviewing ? (
                <span className="text-xs text-slate">
                  {notes[page.position]?.trim() ? "Noted." : ""}
                </span>
              ) : null}
            </figcaption>
            {reviewing ? (
              <textarea
                value={notes[page.position] ?? ""}
                onChange={(event) =>
                  setNotes((current) => ({
                    ...current,
                    [page.position]: event.target.value,
                  }))
                }
                rows={2}
                maxLength={2000}
                placeholder="What should change on these pages?"
                className="w-full rounded-md border border-stone bg-charcoal px-4 py-3 text-sm text-parchment placeholder:text-slate focus:border-pewter focus:outline-none"
              />
            ) : null}
          </figure>
        ))}
      </div>

      {mode === "review" ? (
        <div className="flex flex-col gap-5 border-t border-stone pt-8">
          {reviewing ? (
            <>
              <div className="flex flex-col gap-2">
                <label
                  htmlFor="album-note"
                  className="text-xs uppercase tracking-[0.3em] text-slate"
                >
                  About the album as a whole
                </label>
                <textarea
                  id="album-note"
                  value={albumNote}
                  onChange={(event) => setAlbumNote(event.target.value)}
                  rows={3}
                  maxLength={2000}
                  placeholder="Overall pacing, photos you miss, anything at all."
                  className="w-full rounded-md border border-stone bg-charcoal px-4 py-3 text-sm text-parchment placeholder:text-slate focus:border-pewter focus:outline-none"
                />
              </div>
              <div className="flex flex-wrap items-center gap-4">
                <button
                  type="button"
                  onClick={send}
                  disabled={pending || noteCount === 0}
                  className="rounded-md bg-parchment px-6 py-3 text-sm text-ink transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  {pending
                    ? "Sending."
                    : noteCount > 0
                      ? `Send ${noteCount} ${noteCount === 1 ? "note" : "notes"} to your designer`
                      : "Send notes to your designer"}
                </button>
                <button
                  type="button"
                  onClick={() => setReviewing(false)}
                  disabled={pending}
                  className="text-sm text-pewter transition-colors hover:text-parchment"
                >
                  Never mind
                </button>
              </div>
            </>
          ) : (
            <div className="flex flex-wrap items-center gap-4">
              <button
                type="button"
                onClick={approve}
                disabled={pending}
                className="rounded-md bg-parchment px-6 py-3 text-sm text-ink transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {pending ? "One moment." : "This is the one — approve it"}
              </button>
              <button
                type="button"
                onClick={() => setReviewing(true)}
                disabled={pending}
                className="rounded-md border border-stone px-6 py-3 text-sm text-pewter transition-colors hover:border-pewter hover:text-parchment"
              >
                Request changes
              </button>
            </div>
          )}
          {result.status === "error" ? (
            <p role="alert" className="text-sm text-pewter">
              {result.message}
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
