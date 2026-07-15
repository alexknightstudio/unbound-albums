"use server";

import { headers } from "next/headers";

import { createClient } from "@/lib/supabase/server";

export type LoginState = {
  status: "idle" | "sent" | "error";
  message?: string;
};

export async function requestMagicLink(
  _previous: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim();

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { status: "error", message: "That doesn't look like an email address." };
  }

  const headerList = await headers();
  const origin =
    headerList.get("origin") ??
    `https://${headerList.get("host") ?? "unbound-albums.vercel.app"}`;

  const supabase = await createClient();

  // emailRedirectTo must stay free of a query string — the email template appends
  // `?token_hash=...` to it verbatim.
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${origin}/auth/confirm` },
  });

  if (error) {
    return {
      status: "error",
      message: "We couldn't send that link. Give it a moment and try again.",
    };
  }

  // Success looks identical whether or not the address already has an account —
  // sign-up and sign-in are one flow. Nothing here can be used to test whether a
  // given couple is a customer.
  return { status: "sent" };
}
