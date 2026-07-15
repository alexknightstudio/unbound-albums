"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import {
  ALBUM_SIZES,
  ALBUM_SIZE_SPECS,
  type AlbumSize,
  BASE_SPREAD_COUNT,
  DEFAULT_ALBUM_SIZE,
  formatPrice,
} from "@/lib/albums/sizes";

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
      {pending ? "Creating." : "Start your album"}
    </button>
  );
}

export function NewAlbumForm() {
  const [state, formAction] = useActionState(createAlbum, INITIAL);
  const [size, setSize] = useState<AlbumSize>(DEFAULT_ALBUM_SIZE);

  return (
    <form action={formAction} className="flex w-full flex-col gap-8">
      <div className="flex flex-col gap-2">
        <label htmlFor="title" className="text-sm text-pewter">
          What should we call it?
        </label>
        <input
          id="title"
          name="title"
          type="text"
          required
          maxLength={120}
          autoComplete="off"
          className="w-full rounded-md border border-stone bg-charcoal px-4 py-3.5 text-base text-parchment placeholder:text-slate focus:border-pewter focus:outline-none"
          placeholder="Sarah & James"
        />
      </div>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-3 text-sm text-pewter">Choose a size.</legend>

        <div className="grid grid-cols-3 gap-3">
          {ALBUM_SIZES.map((option) => {
            const spec = ALBUM_SIZE_SPECS[option];
            const selected = size === option;
            return (
              <label
                key={option}
                className={`flex cursor-pointer flex-col items-center gap-1.5 rounded-md border px-3 py-5 transition-colors ${
                  selected
                    ? "border-parchment bg-charcoal"
                    : "border-stone hover:border-slate"
                }`}
              >
                <input
                  type="radio"
                  name="size"
                  value={option}
                  checked={selected}
                  onChange={() => setSize(option)}
                  className="sr-only"
                />
                <span
                  className={`font-display text-2xl ${selected ? "text-parchment" : "text-pewter"}`}
                >
                  {spec.label}
                </span>
                <span className="text-xs text-slate">
                  {formatPrice(spec.priceCents)}
                </span>
              </label>
            );
          })}
        </div>

        <p className="text-xs text-slate">
          {BASE_SPREAD_COUNT} spreads, hardcover, printed by a professional lab.
          You only pay when you order.
        </p>
      </fieldset>

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
