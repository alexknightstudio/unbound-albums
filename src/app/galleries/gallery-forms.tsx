"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import {
  activatePhotographerAccount,
  createGallery,
  type GalleryActionState,
} from "./actions";

const IDLE: GalleryActionState = { status: "idle" };

const LABEL = "text-sm font-medium text-body";
const FIELD =
  "w-full rounded-md border border-line-strong bg-neutral-0 px-3.5 py-2.5 text-base text-heading shadow-xs placeholder:text-faint focus:border-accent focus:outline-none";

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-md bg-accent px-6 py-2.5 text-sm font-medium text-neutral-0 shadow-xs transition-colors hover:bg-accent-hover disabled:opacity-50"
    >
      {pending ? "One moment…" : label}
    </button>
  );
}

function ErrorLine({ state }: { state: GalleryActionState }) {
  if (state.status !== "error") return null;
  return (
    <p role="alert" className="text-sm text-danger">
      {state.message}
    </p>
  );
}

export function ActivateForm() {
  const [state, action] = useActionState(activatePhotographerAccount, IDLE);
  return (
    <form action={action} className="flex w-full max-w-md flex-col gap-5">
      <div className="flex flex-col gap-2.5">
        <label htmlFor="business_name" className={LABEL}>
          Your studio name
        </label>
        <input
          id="business_name"
          name="business_name"
          type="text"
          required
          maxLength={120}
          className={FIELD}
          placeholder="Alex Knight Studio"
        />
      </div>
      <Submit label="Open your gallery space" />
      <ErrorLine state={state} />
    </form>
  );
}

export function NewGalleryForm() {
  const [state, action] = useActionState(createGallery, IDLE);
  return (
    <form action={action} className="flex w-full max-w-md flex-col gap-5">
      <div className="flex flex-col gap-2.5">
        <label htmlFor="title" className={LABEL}>
          Gallery title
        </label>
        <input
          id="title"
          name="title"
          type="text"
          required
          maxLength={160}
          className={FIELD}
          placeholder="Sofia & Marc — Tulum"
        />
      </div>
      <div className="flex flex-col gap-2.5">
        <label htmlFor="event_date" className={LABEL}>
          Event date <span className="normal-case tracking-normal">(optional)</span>
        </label>
        <input id="event_date" name="event_date" type="date" className={FIELD} />
      </div>
      <div className="flex flex-col gap-2.5">
        <label htmlFor="password" className={LABEL}>
          Gallery password <span className="normal-case tracking-normal">(optional)</span>
        </label>
        <input
          id="password"
          name="password"
          type="text"
          maxLength={72}
          autoComplete="off"
          className={FIELD}
          placeholder="Leave empty for link-only access"
        />
      </div>
      <Submit label="Create gallery" />
      <ErrorLine state={state} />
    </form>
  );
}
