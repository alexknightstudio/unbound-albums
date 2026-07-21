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
      className="w-full rounded-md bg-accent px-6 py-2.5 text-sm font-medium text-neutral-0 shadow-xs transition-colors hover:bg-accent-hover disabled:opacity-50"
    >
      {pending ? "Sending…" : "Email me a link"}
    </button>
  );
}

export function LoginForm({ linkError }: { linkError?: string }) {
  const [state, formAction] = useActionState(requestMagicLink, INITIAL);

  if (state.status === "sent") {
    return (
      <div className="flex flex-col gap-2 text-center">
        <p className="text-lg font-semibold text-heading">Check your email.</p>
        <p className="text-sm text-muted">
          We sent a link. It works for one hour, on any device.
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex w-full flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="email" className="text-sm font-medium text-body">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className="w-full rounded-md border border-line-strong bg-neutral-0 px-3.5 py-2.5 text-base text-heading shadow-xs placeholder:text-faint focus:border-accent focus:outline-none"
          placeholder="you@example.com"
        />
      </div>

      <SubmitButton />

      {(state.status === "error" || linkError) && (
        <p role="alert" className="text-sm text-danger">
          {state.message ?? linkError}
        </p>
      )}
    </form>
  );
}
