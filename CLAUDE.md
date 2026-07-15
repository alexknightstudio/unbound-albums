# CLAUDE.md — Unbound Albums

## What this project is

Unbound Albums (unboundalbums.com) is a self-serve AI wedding album creator. Couples upload ~150 curated wedding photos; Claude's vision API analyzes every photo; a layout engine arranges them into professionally designed album spreads; couples preview for free, edit with a full drag-and-drop editor, design their cover, and pay to order a premium printed hardcover ($149–249). Fulfillment is manual in v1 (founder orders through Miller's Lab / Bay Photo from an admin panel).

The founder is Alex Knight, a professional wedding photographer. He is technical-adjacent but not a developer — explain decisions plainly, and never assume he'll debug raw stack traces alone.

## Product decisions — LOCKED (do not relitigate)

- Fully self-serve: AI output goes straight to couples, no human review step
- Full editor: drag photos between slots, change spread templates, reorder spreads
- Free preview; payment only at print order (Stripe Checkout)
- Curated upload: couples select ~150 photos (hard cap 200), not full galleries
- Layout + smart color correction only. Correction applies ONLY to images detected as uncorrected (phone photos); professionally edited photos pass through untouched. NO skin smoothing, NO obstruction removal in v1.
- Full cover designer: hero image picker (AI pre-ranks candidates), title/subtitle, 3 layout styles
- Print only — no digital-only product. Every order includes a free shareable web preview link.
- Upsell: additional copies of the same album at 30% off (parent albums)
- Print fulfillment: MANUAL in v1 via admin panel. No print API integration.
- Pricing v1: 8×8 $149 · 10×10 $199 · 12×12 $249 (30 spreads base; placeholder, easily configurable)

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

## Brand — apply everywhere

- Strictly monochromatic: Ink #0A0A0A, Charcoal #1A1A18, Stone #2C2B28, White #FFFFFF, Parchment #FAF9F7, Linen #F0EDE8, Pewter #9A9890, Slate #6B6960. NO accent color, ever. The couple's photos are the only color in the product.
- Type: Cormorant Garamond (display, 300 weight only at 36px+) + Jost (body/UI, 400 minimum). Nothing below 13px.
- Dark-first UI (#0A0A0A) — photos pop on dark. Light sections (Parchment) for rhythm.
- Border-radius 6px max. Generous spacing. Editorial, never bubbly.
- Voice in all UI copy: warm, confident, short declaratives, periods not exclamation marks. Never "AI-powered," "algorithm," "seamless," "leverage." Say what it does: "Fifty photos of the sunset? We'll pick the one."
- Tagline: "Your love story, *unbound.*" (italic, not color, for emphasis)

## Working agreements

- Work in the phases defined in BUILD_PLAN.md. Do not start a phase early; do not gold-plate.
- Every phase ends with something Alex can click and test on his phone.
- When a decision isn't covered here or in BUILD_PLAN.md, propose the simplest option and ask — don't build speculatively.
- Write tests for the layout engine and the pricing/order math. UI tests are optional in v1.
- Keep a running DECISIONS.md log — one line per decision made during the build.
