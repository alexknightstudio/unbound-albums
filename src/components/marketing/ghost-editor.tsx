import { GhostSpread } from "./ghost-spread";

/**
 * An abstract miniature of the real editor: layout rail on the left, the
 * spread at center, the couple's controls beneath. Same ghost language as
 * the hero — geometry, not screenshots, so it never goes stale.
 */

const RAIL = ["T1", "M4", "D5", "M2"] as const;
const CONTROLS = ["Leather or linen", "A cameo, if you like", "A note on any page", "Revisions until it's right"];

export function GhostEditor() {
  return (
    <div aria-hidden className="rounded-md border border-stone bg-charcoal p-4 sm:p-6">
      <div className="flex gap-4 sm:gap-6">
        <div className="hidden w-20 shrink-0 flex-col gap-2.5 sm:flex">
          {RAIL.map((code) => (
            <div
              key={code}
              className={
                code === "D5"
                  ? "rounded-[2px] ring-1 ring-parchment"
                  : "opacity-45"
              }
            >
              <GhostSpread code={code} />
            </div>
          ))}
        </div>
        <div className="min-w-0 flex-1 self-center">
          <GhostSpread code="D5" />
        </div>
      </div>
      <div className="mt-5 flex flex-wrap gap-2">
        {CONTROLS.map((label) => (
          <span
            key={label}
            className="rounded-md border border-stone px-3 py-1.5 text-xs text-pewter"
          >
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}
