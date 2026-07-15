"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { requestMagicLink, type LoginState } from "./actions";

const INITIAL: LoginState = { status: "idle" };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-md bg-parchment px-6 py-3.5 text-sm text-ink transition-opacity hover:opacity-90 disabled:opacity-50"
    >
      {pending ? "Sending." : "Email me a link"}
    </button>
  );
}

export function LoginForm({ linkError }: { linkError?: string }) {
  const [state, formAction] = useActionState(requestMagicLink, INITIAL);

  if (state.status === "sent") {
    return (
      <div className="flex flex-col gap-4 text-center">
        <p className="font-display text-4xl text-parchment">Check your email.</p>
        <p className="text-sm text-pewter">
          We sent a link. It works for one hour, on any device.
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex w-full flex-col gap-5">
      <div className="flex flex-col gap-2">
        <label htmlFor="email" className="text-sm text-pewter">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className="w-full rounded-md border border-stone bg-charcoal px-4 py-3.5 text-base text-parchment placeholder:text-slate focus:border-pewter focus:outline-none"
          placeholder="you@example.com"
        />
      </div>

      <SubmitButton />

      {(state.status === "error" || linkError) && (
        <p role="alert" className="text-sm text-pewter">
          {state.message ?? linkError}
        </p>
      )}
    </form>
  );
}
