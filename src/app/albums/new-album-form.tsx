"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { createAlbum, type CreateAlbumState } from "./actions";

const INITIAL: CreateAlbumState = { status: "idle" };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="mt-3 w-full rounded-md bg-parchment px-7 py-[18px] text-xs font-medium uppercase tracking-[2.5px] text-ink transition-all hover:bg-white hover:shadow-[0_4px_20px_rgba(255,255,255,0.15)] active:scale-[0.98] disabled:opacity-50"
    >
      {pending ? "One moment." : "Continue — add your photos"}
    </button>
  );
}

const LABEL =
  "text-xs font-medium uppercase tracking-[2.5px] text-pewter";
const FIELD =
  "w-full rounded-md border border-stone bg-charcoal px-[18px] py-[15px] text-base tracking-[0.3px] text-parchment transition-colors placeholder:text-slate hover:border-[#3B3A36] focus:border-white/45 focus:shadow-[0_0_0_3px_rgba(255,255,255,0.12)] focus:outline-none [color-scheme:dark]";

/** The start of everything: who, when, where. Size and style come later —
 * that's the customizations step, after the photos are in. */
export function NewAlbumForm() {
  const [state, formAction] = useActionState(createAlbum, INITIAL);

  return (
    <form action={formAction} className="flex w-full flex-col gap-7">
      <div className="flex flex-col gap-2.5">
        <label htmlFor="title" className={LABEL}>
          Your names
        </label>
        <input
          id="title"
          name="title"
          type="text"
          required
          maxLength={120}
          autoComplete="off"
          className={FIELD}
          placeholder="Sarah & James"
        />
      </div>

      <div className="flex flex-col gap-2.5">
        <label htmlFor="event_date" className={LABEL}>
          Your wedding date
        </label>
        <input
          id="event_date"
          name="event_date"
          type="date"
          required
          className={FIELD}
        />
      </div>

      <div className="flex flex-col gap-2.5">
        <label htmlFor="venue" className={LABEL}>
          Venue or location
        </label>
        <input
          id="venue"
          name="venue"
          type="text"
          required
          maxLength={160}
          autoComplete="off"
          className={FIELD}
          placeholder="The Foundry, Long Island City"
        />
      </div>

      <div className="flex flex-col gap-3">
        <SubmitButton />
        {state.status === "error" && (
          <p role="alert" className="text-sm text-pewter">
            {state.message}
          </p>
        )}
      </div>
    </form>
  );
}
