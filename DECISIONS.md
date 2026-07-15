# DECISIONS.md — Unbound Albums

One line per decision made during the build. Newest at the bottom.

## Phase 1 — Foundation

- **2026-07-15** — Project git repo initialized at the project folder. It previously resolved to `/Users/alexknight`, which would have risked committing personal files to GitHub.
- **2026-07-15** — GitHub repo `alexknightstudio/unbound-albums` is **private**; it will hold Supabase/Stripe config and is a commercial product.
- **2026-07-15** — Scaffolded on Next.js 16 + Tailwind v4 (current versions as of build). Tailwind v4 configures via CSS `@theme` in `globals.css`, not `tailwind.config.ts` — brand tokens live there.
- **2026-07-15** — Supabase project region `us-west-2` (Oregon), Postgres 17.
- **2026-07-15** — Database schema is managed as **migrations in the repo** (`supabase/migrations/`), never clicked together in the dashboard. Schema is code: reviewable, repeatable, rebuildable.
- **2026-07-15** — Locked vocabularies (album status, size, order status, photo orientation) are Postgres **enums**; template codes and regen limits are **check constraints**. A bad value fails at write time instead of rendering a broken spread.
- **2026-07-15** — Admin is a row in an `admins` table, not a JWT claim: revoking is a delete, and it cannot be forged client-side.
- **2026-07-15** — `orders.album_id` uses `on delete restrict` (not cascade). A paid order must survive album deletion — losing the record of something someone paid for is not an acceptable failure mode.
- **2026-07-15** — Orders are **read-only to couples**. They are created by the Stripe webhook and advanced by the admin panel, both service-role paths. A client that can write an order is a client deciding what it paid.
- **2026-07-15** — `share_slug` defaults to `gen_random_uuid()` hex (122 bits, CSPRNG) rather than a pgcrypto call — unguessable with zero extension-schema dependency. Share-link *read access* is deferred to Phase 3, where it belongs.
- **2026-07-15** — All four storage buckets (`originals`, `thumbs`, `renders`, `print`) are **private**. Wedding photos are never served from a public URL; the app issues short-lived signed URLs. `print` is admin-only.
- **2026-07-15** — The 200-photo hard cap is enforced in the upload flow, not by a database trigger. A counting trigger races under parallel uploads; the failure mode (a 201st photo) does not justify the locking complexity. Revisit if it ever actually happens.
- **2026-07-15** — RLS verified by adversarial test, not by trusting the migration: a second logged-in user could not read, target, steal, or plant albums, could not read `admins`, and could not forge an order; the rightful owner could still read and write their own. Test users deleted afterward.
