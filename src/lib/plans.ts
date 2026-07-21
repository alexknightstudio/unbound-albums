/**
 * Plans — config-driven, like sizes.ts before it (PLATFORM_SPEC.md §5).
 * Prices are HOSTING_SPEC.md's approved placeholders; enforcement lands in
 * P4 (billing). Marketing and the app read from here — nothing hardcodes
 * a price or a cap.
 */

export type PlanId = "free" | "solo" | "studio" | "pro";

export type Plan = {
  id: PlanId;
  label: string;
  monthlyCents: number;
  annualMonthlyCents: number;
  storageGb: number;
  seats: number;
  blurb: string;
};

export const PLANS: readonly Plan[] = [
  {
    id: "free",
    label: "Free",
    monthlyCents: 0,
    annualMonthlyCents: 0,
    storageGb: 10,
    seats: 1,
    blurb: "Every feature, unlimited galleries and sharing. Just less shelf space.",
  },
  {
    id: "solo",
    label: "Solo",
    monthlyCents: 1900,
    annualMonthlyCents: 1500,
    storageGb: 500,
    seats: 1,
    blurb: "A working photographer's year of delivery.",
  },
  {
    id: "studio",
    label: "Studio",
    monthlyCents: 3600,
    annualMonthlyCents: 2900,
    storageGb: 1500,
    seats: 3,
    blurb: "For small teams — three seats included.",
  },
  {
    id: "pro",
    label: "Pro",
    monthlyCents: 6000,
    annualMonthlyCents: 4800,
    storageGb: 3000,
    seats: 5,
    blurb: "High volume, priority support.",
  },
] as const;

/** Overage: $6 per 100 GB — soft-capped, opt-in, never a surprise bill. */
export const OVERAGE_CENTS_PER_100GB = 600;

export function planById(id: string): Plan {
  return PLANS.find((p) => p.id === id) ?? PLANS[0];
}

export function formatPlanPrice(cents: number): string {
  return cents === 0 ? "$0" : `$${Math.round(cents / 100)}`;
}
