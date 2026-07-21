# CLAUDE.md — Unbound Albums

## What this project is

Unbound Albums (unboundalbums.com) is a designed-for-you wedding album service. Couples upload ~150 curated wedding photos and answer a short style brief (cover material, cameo, foil font, mood); a professional album designer creates the album in their own pro tools (SmartAlbums / Fundy / InDesign) and uploads finished spread images as a proof; couples review, leave per-page revision notes, and approve. The design is free. Revenue: a premium printed hardcover ($249–299, placeholder pricing) or a $99 print-ready file download for couples who print elsewhere. Fulfillment is manual in v1.

The founder is Alex Knight, a professional wedding photographer. He is technical-adjacent but not a developer — explain decisions plainly, and never assume he'll debug raw stack traces alone.

## Product decisions — LOCKED (do not relitigate)

**PIVOT (2026-07-17): human designers, not client-facing AI.** Alex judged AI design output not yet good enough to sell. Hired designers design every album in external pro tools and upload finished spreads. The AI pipeline (analysis, layout engine, editor, steerable regen) is DORMANT, not deleted — kept as possible future internal designer tooling. Do not route couples through it.

**Studio-review model (2026-07-17, later same day — refines the pivot):**
- Every album is designed within **1–3 days**, with a studio review step before the couple ever sees a page: production flow **generating → review → ready**.
- Implementation note: the shipped DB status machine still uses the earlier naming (uploading → briefing → in_design → proof_ready ⇄ in_revision → approved); `generating` and `ready` exist in the enum, `review` does not yet. Align the machine to the studio-review flow the next time the flow is touched — do not start that rework from a marketing task.
- **The free-design hook is core positioning:** "design is free, pay only to print." Every page of the site and app reinforces it.
- **The preview is a shareable 3D flip-through** — that is what couples see and share for free. Print-quality files ship ONLY with paid orders (a print order, or the $99 file download). Nothing print-resolution leaves unpaid.

- Designed-for-you: a human designer creates every album; couples never design
- Client flow: upload → brief (style questionnaire) → studio designs & reviews → couple reviews the flip-through proof → revision notes → approve → print order or file download
- Couples' only controls: the brief, per-page revision notes, approve. No client editor.
- Revisions: no hard cap in v1 (small volume); designer discretion
- Free design; monetization is the print order OR a $99 print-ready file download (DOWNLOAD_PRICE_CENTS in src/lib/albums/sizes.ts). Files are watermark-free, full-res, delivered only after payment.
- Brief options v1 (src/lib/albums/brief.ts): cover material (linen / leather / distressed leather / velvet + color set per material), cameo (none / front photo window), foil font style (serif / script / modern), design mood (classic / editorial / romantic), free-text notes
- Designers are staff: `staff` table (role designer/admin), work from /studio queue; designer accounts created manually in v1
- Curated upload: couples select ~150 photos (hard cap 200), not full galleries
- Print only for physical product; every album keeps the free shareable web preview link
- Print fulfillment: MANUAL in v1 via admin panel. No print API integration. (Aspiration: a DreamBooks Pro partnership — Alex's current album producer — once UNBOUND is real enough to pitch; Miller's/Bay remain the v1 path.)
- Sizes v2 (2026-07-16): 10×10 (hero) · 12×12 · 11×14. 8×8 dropped. The album is 15 spreads, flat price.
- Pricing v1: 10×10 $249 · 12×12 $279 · 11×14 $299 (placeholder pending DreamBooks economics; easily configurable in src/lib/albums/sizes.ts)
- Print spec (Miller's): full-spread files (page width × 2) at 250 DPI, no bleed, 0.5" safe zone from trim edges, no faces on the centerfold. Albums start AND end with full panorama spreads — there are no single first/last pages. Designers must deliver to this spec.

**Approved product directions (2026-07-20, both specs approved in full by Alex):**
- **Unbound Galleries (HOSTING_SPEC.md)**: B2B client-gallery hosting under the SAME Unbound brand. Cloudflare R2 for gallery files (zero egress) + Cloudflare Images derivatives; Supabase stays auth/db; file access via short-TTL signed URLs in app code (not RLS). Pricing: Solo $19/500GB · Studio $36/1.5TB/3 seats · Pro $60/3TB, overage $6/100GB (configurable). Two locked promises: unlimited traffic, never "unlimited storage"; and NEVER silently delete a gallery (non-payment freezes uploads, never destroys data) — this is a ToS commitment.
- **Album Designer (DESIGNER_SPEC.md)**: canvas-free architecture — DOM/CSS frames + SVG overlay, dnd-kit, DOM text, normalized 0–1 geometry; Konva is the documented escape hatch, Fabric rejected. Print parity = the same SpreadRenderer mounted at print pixels in Puppeteer, captured with page.screenshot() (NOT page.pdf — it ignores deviceScaleFactor). Sequencing: print pipeline FIRST (it unlocks the $99 download and print orders), then staff designer workspace, then pro layout tools, then in-app proof delivery. In-house designers are the first users (replacing SmartAlbums seats); B2B packaging and free-form frames wait.

## Stack

- **Next.js (App Router) + TypeScript + Tailwind CSS**, deployed on Vercel
- **Supabase**: Postgres, Auth (email magic link), Storage (originals, web renders, print files)
- **Anthropic API** (Claude vision) for photo analysis + layout generation — prompts live in `/lib/ai/prompts/` as versioned files
- **dnd-kit** for the editor drag-and-drop
- **Stripe Checkout** for payments (webhook → order record)
- **Print PDF generation**: Puppeteer rendering the same React spread templates to 300-DPI PDF. Preview and print share one rendering path = guaranteed WYSIWYG. Runs as a background job (Vercel function limits may force a small external worker — Fly.io/Railway — decide when we get there, not before).

## Architecture principles

1. **The layout engine is the product.** It lives in `/lib/engine/` as a pure, testable module: metadata in → spread plan out. No UI imports, no DB calls inside it. It must be swappable and unit-tested.
2. **Spread templates are React components** with a strict slot contract (`/components/spreads/`). Template codes: Hero H1–H3, Duo D1–D5, Trio T1–T5, Multi M1–M7, Detail DT1–DT3. Every template renders identically in preview and print.
3. **AI calls are batched and cached.** Photo analysis: 10–15 images per call, results stored as JSONB on the photo row, never re-analyzed. Regeneration limits: 3 per spread, 1 full-album regenerate. API cost per album must stay under $6.
4. **Uploads must be bulletproof.** Resumable (TUS via Supabase), HEIC accepted (thumbnails generated server-side), 2–3 parallel max, per-file progress with retry. Test on iOS Safari before calling any upload work done.
5. **Status is a state machine.** Album status: `uploading → analyzing → generating → ready → ordered → shipped`. Every transition is explicit and logged.

## Data model (Postgres via Supabase)

```
users        — Supabase Auth (couples)
albums       — id, user_id, title, status, size, cover jsonb
               (hero_photo_id, title_text, subtitle_text, layout_style),
               share_slug, created_at
photos       — id, album_id, storage_path, thumb_path, upload_order,
               orientation, analysis jsonb, needs_correction bool
spreads      — id, album_id, position, template_code,
               slots jsonb ({slot_id: photo_id}), regen_count
orders       — id, album_id, stripe_session_id, amount, size, quantity,
               shipping jsonb, status (paid/sent_to_lab/shipped),
               lab_order_ref, print_pdf_path
```

RLS: couples read/write only their own rows. Share links use unguessable slugs, read-only. Admin (Alex) role sees the order queue.

## Brand — apply everywhere (v2, 2026-07-21 — the light photo-SaaS system)

**The old strict-monochrome, dark-first, Cormorant wedding-editorial system is RETIRED for app and marketing surfaces** (Alex's design-refresh directive; tokens approved 2026-07-21). New reference class: Pixieset/SmugMug — light, airy, calm, premium, never loud.

- **Neutrals (cool gray ramp, tokens in globals.css):** surface #FFFFFF (`neutral-0`) · canvas #F8F9FB · well #F1F3F6 · line #E4E7EC · line-strong #D0D5DD · faint #98A2B3 · muted #667085 · body #344054 · heading #101828.
- **ONE accent — Cobalt #2563EB** (`accent`, hover #1D4ED8, soft #EFF6FF, border #BFDBFE): primary CTAs, links, active nav, focus rings, selected states. Nothing else is blue. Functional green (#039855) and red (#D92D20) exist only for success/destructive moments.
- **Type: Inter only** (400/500/600 — no light weights), headings semibold with tight tracking. Scale: 30/38 page titles · 24 stat numerals · 18/28 sections · 15/24 body · 14 UI labels (medium) · 13 captions; marketing hero up to ~60 semibold. Nothing below 13px.
- **Spacing** on a 4px base (4→96). **Radius:** 8 default, 12 cards, pills allowed for badges/avatars. **Shadows:** the xs/sm/md/lg ramp in globals.css — soft, sub-10% opacity, never glows.
- **The sacred exception:** the gallery viewer, lightbox, and unlock gate stay photo-forward on the near-black `viewer` surface (#101113) with minimal chrome — photos are the interface. SaaS styling stops at the gallery's edge. (The print SpreadRenderer likewise keeps its own white/linen page colors — print output never restyles.)
- **Voice:** warm, confident, short declaratives, periods not exclamation marks. Never "AI-powered," "algorithm," "seamless," "leverage." Promise only what's built. No fake testimonials, stats, or reviews — ever.
- **Tagline:** "Your photos, hosted beautifully." Audience: anyone first, photographers as the power users (PLATFORM_SPEC §12 Q2, answered 2026-07-21).
- Legacy wedding-era tokens (ink/parchment/etc.) remain defined in globals.css ONLY so pre-P0 pages compile; do not use them in new code — they're removed with the de-wedding PR.

## Working agreements

- Work in the phases defined in BUILD_PLAN.md. Do not start a phase early; do not gold-plate.
- Every phase ends with something Alex can click and test on his phone.
- When a decision isn't covered here or in BUILD_PLAN.md, propose the simplest option and ask — don't build speculatively.
- Write tests for the layout engine and the pricing/order math. UI tests are optional in v1.
- Keep a running DECISIONS.md log — one line per decision made during the build.
- The ui-ux-pro-max skill may be used for UX patterns, spacing, accessibility, and component quality — but the brand rules in this file (colors, typography, voice) always override any style, palette, or font suggestion from the skill.
