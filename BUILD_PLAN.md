# BUILD_PLAN.md — Unbound Albums (6-Week Plan)

Target: launch-ready in 4–6 weeks. Alex drives Claude Code 10+ hrs/week. Every phase ends with a testable milestone. Phases are sequential — do not skip ahead.

---

## Phase 1 — Foundation (Week 1)

**Goal: a couple can sign up and upload photos that survive bad WiFi.**

1. Scaffold Next.js (App Router, TypeScript, Tailwind) with the brand tokens from CLAUDE.md as the Tailwind theme. Deploy to Vercel on day one — every later change ships to a real URL.
2. Supabase project: schema from CLAUDE.md, RLS policies, storage buckets (`originals`, `thumbs`, `renders`, `print`).
3. Auth: email magic link. Minimal account surface — couples sign up, land on "Create your album."
4. Album creation: title, size selection (8×8 / 10×10 / 12×12), status machine wired.
5. **Upload flow (the critical path):** resumable uploads via Supabase TUS, 150-photo target / 200 hard cap, HEIC accepted, 2–3 parallel, per-file progress, retry on failure, orientation read from EXIF. Server-side thumbnail generation (edge function).
6. ✅ **Milestone test:** Alex uploads 150 real wedding photos from his iPhone on cellular. Zero silent failures.

---

## Phase 2 — The AI Pipeline (Week 2)

**Goal: photos in → complete album plan out, automatically.**

1. Port the Photo Analysis prompt into `/lib/ai/prompts/analysis.ts` (versioned). Batch endpoint: 10–15 photos per Claude vision call, JSONB results on photo rows, progress surfaced to the UI ("Analyzing your photos… 84 of 150").
2. `needs_correction` detection during analysis (professionally-edited vs uncorrected heuristic). Auto color/exposure correction applied ONLY to flagged photos (sharp/pillow via edge function or processing step). Corrected version stored alongside original; couple can revert per-photo later.
3. Port the Layout Engine prompt into `/lib/ai/prompts/layout.ts`. Engine module in `/lib/engine/`: takes all photo metadata → returns spread plan (template codes + slot assignments) following the chronological/balance rules. Unit tests with fixture metadata.
4. Persist the plan to `spreads` rows. Status: `analyzing → generating → ready`.
5. Cost guardrails: analysis cached forever, regen counters enforced.
6. ✅ **Milestone test:** run 3 real wedding galleries end-to-end. Alex reviews the raw plans with his professional eye; prompt corrections get committed as new prompt versions. (This IS the manual validation, now inside the product.)

---

## Phase 3 — Preview & Spread Rendering (Week 3)

**Goal: the emotional moment — a couple sees their album for the first time.**

1. Build the template library: all 23 spread templates (H1–H3, D1–D5, T1–T5, M1–M7, DT1–DT3) as React components with the strict slot contract. Photos object-fit correctly per slot; portrait/landscape handled.
2. Album preview: spread-by-spread horizontal viewer, "Spread 4 of 16" indicator, thumbnail filmstrip navigation, mobile swipe support.
3. The reveal: a considered loading experience during generation (progress steps in brand voice — "Reading the light in every photo…"), then the finished album. This moment converts; design it with care.
4. Shareable read-only link (`/a/{share_slug}`) — the free web preview that ships with every album.
5. ✅ **Milestone test:** a beta couple (not Alex) views their real album on a phone and reacts. Record the reaction.

---

## Phase 4 — Editor & Cover Designer (Week 4)

**Goal: couples can make it theirs.**

1. Editor mode on the preview: select a photo (white border highlight), swap with any unused photo from a side tray, drag photos between slots (dnd-kit), remove a photo.
2. Per-spread controls: change template (compatible templates offered based on photo count/orientations), "Regenerate this spread" (max 3), drag to reorder spreads in the filmstrip.
3. Unused-photos tray: everything uploaded but not placed, including AI-removed near-duplicates in an expandable "We set these aside" section — trust through transparency.
4. Cover designer: AI-ranked hero candidates grid (top `hero_potential` couple portraits), title + subtitle inputs with live preview, 3 layout styles (centered / bottom-left / minimal), rendered like a real book with spine.
5. Per-photo revert for auto-corrected images.
6. ✅ **Milestone test:** Alex rebuilds a spread the AI got wrong in under 60 seconds on mobile.

---

## Phase 5 — Money & Fulfillment (Week 5)

**Goal: someone can pay, and Alex can fulfill.**

1. Stripe Checkout: size-based pricing (from config), quantity with 30%-off additional copies (parent albums), shipping address collection, webhook → order record, `ready → ordered`.
2. Print PDF generation: Puppeteer renders the same spread components at 300 DPI to a print-ready PDF (cover + interior, sized per album, with bleed). Background job; PDF stored in `print` bucket. If Vercel limits bite, stand up the small worker (Fly/Railway) — not before.
3. Admin panel (`/admin`, Alex only): order queue, download print PDF, one-click copy of shipping details, mark `sent_to_lab` (with lab ref) and `shipped`. Manual Miller's/Bay Photo ordering happens outside the app.
4. Transactional emails (Resend): order confirmation, shipped notification. Brand voice.
5. ✅ **Milestone test:** Alex places a real test order end-to-end, downloads the PDF, and orders one physical album from Miller's with it. The printed album is the QA.

---

## Phase 6 — Polish & Launch (Week 6)

**Goal: strangers can use it without Alex on standby.**

1. Landing page at unboundalbums.com (the design already exists — hero "Your love story, *unbound.*", problem stats, how-it-works, album showcase now using REAL spreads from beta albums, pricing, FAQ).
2. Mobile pass on every flow. Empty states, error states, loading states — all in brand voice.
3. Onboarding guidance: "How to pick your 150" helper (export from Pic-Time/photographer galleries).
4. Analytics (PostHog or Vercel Analytics): funnel events — signup, upload complete, generation complete, preview viewed, editor used, checkout started, paid.
5. Beta run: 3–5 real couples through the full flow, print at least 2 physical albums, fix what breaks.
6. ✅ **Launch gate:** one couple completes upload → preview → edit → pay with zero founder intervention, and one physical album in hand looks like something a professional designed.

---

## Deferred — explicitly NOT in v1 (log ideas here, build later)

Print API automation · skin smoothing / obstruction removal · Instagram grid product · full-gallery AI culling · multiple album projects per event · gift/registry flows · photographer/B2B portal · Unposed integration · digital-only tier

## Cost & ops notes

- API cost target: <$6 per generated album (analysis ~$3–5 + layout ~$0.50 + regens)
- Storage: ~2–4GB per album; lifecycle cleanup is a post-launch task
- Env vars: `ANTHROPIC_API_KEY`, `SUPABASE_*`, `STRIPE_*`, `RESEND_API_KEY`
- Free-preview abuse is naturally limited (needs 150 wedding photos); add rate limiting only if it actually happens
