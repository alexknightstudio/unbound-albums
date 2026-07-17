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
      className="w-full rounded-md bg-parchment px-6 py-3.5 text-sm text-ink transition-opacity hover:opacity-90 disabled:opacity-50"
    >
      {pending ? "One moment." : "Continue — add your photos"}
    </button>
  );
}

const FIELD =
  "w-full rounded-md border border-stone bg-charcoal px-4 py-3.5 text-base text-parchment placeholder:text-slate focus:border-pewter focus:outline-none";

/** The start of everything: who, when, where. Size and style come later —
 * that's the customizations step, after the photos are in. */
export function NewAlbumForm() {
  const [state, formAction] = useActionState(createAlbum, INITIAL);

  return (
    <form action={formAction} className="flex w-full flex-col gap-6">
      <div className="flex flex-col gap-2">
        <label htmlFor="title" className="text-sm text-pewter">
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

      <div className="flex flex-col gap-2">
        <label htmlFor="event_date" className="text-sm text-pewter">
          Your wedding date
        </label>
        <input
          id="event_date"
          name="event_date"
          type="date"
          required
          className={`${FIELD} [color-scheme:dark]`}
        />
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="venue" className="text-sm text-pewter">
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

      <div className="mt-2 flex flex-col gap-3">
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
