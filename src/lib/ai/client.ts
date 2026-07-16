import "server-only";

import Anthropic from "@anthropic-ai/sdk";

/**
 * Anthropic client. Server-side only — the "server-only" import makes the
 * build fail if this ever leaks toward a Client Component, which would ship
 * the API key to the browser.
 */
export function createAnthropicClient() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "Missing environment variable ANTHROPIC_API_KEY. " +
        "Set it in .env.local and in the Vercel project settings.",
    );
  }

  return new Anthropic({ apiKey });
}
