# PLATFORM_SPEC.md — Unbound as an image-hosting platform

*Technical design doc, 2026-07-21. Written after a read-through of the current repo (galleries live on R2 as of commit `23e6949`; wedding-album editor present but AI-coupled) and a research pass on image delivery and gallery-display architecture. Supersedes the framing — not the engineering — of `HOSTING_SPEC.md` and `DESIGNER_SPEC.md`, both of which stay valid and are cited throughout.*

---

## 0. Decisions captured (Alex, 2026-07-21)

Four answers set the direction of everything below:

| Question | Decision | Consequence |
|---|---|---|
| Primary job | **Both** public showcase *and* private client delivery, equally weighted | Galleries need a first-class **visibility** model (public / unlisted / private), not "private by default, full stop" |
| "Album creator" means | **Print photo-book designer** | The creator is the spread-based book designer from `DESIGNER_SPEC.md` — *not* a web-layout tool. Web display is a separate, lighter system (§6) |
| Foundation | **Build on the existing codebase** | Keep R2 + auth + brand + upload path; reposition the data model; rebuild the designer. No infra restart |
| Accounts | **Anyone can sign up** | Generalize `photographer_accounts` → a universal account/profile; multi-tenant for consumers *and* pros |

One clarification I'm carrying as an **assumption** (flag if wrong): "display photos beautifully" is delivered by the **gallery display system** (layouts, lightbox, themes — §6), which is mostly presets and rendering rather than a heavy editor. The **"album creator"** you asked to build in is the **print photo-book designer** (§7). Two different surfaces, two different jobs. The rest of the doc treats them separately.

---

## 1. The product in one paragraph

Unbound is a place to put photos on the internet and have them look expensive — whether you're a wedding photographer delivering a private, PIN-protected client gallery, or anyone who wants a public, search-indexed portfolio of their work. Upload is bulletproof (resumable, thousands of JPEGs, survives bad WiFi). Display is fast and editorial (justified/masonry grids, full-screen lightbox, mobile-first). Every account can also open the **album designer** to turn a set of photos into a print-ready photo book. Storage is cheap and traffic is free by construction (Cloudflare R2, zero egress), so the platform can promise what incumbents won't: unlimited galleries, unlimited guests, unlimited downloads, and *no silent deletion*.

Reference points: **Pixieset / Pic-Time** (private client delivery, favorites, downloads) + **SmugMug** (public portfolios, custom domains, "my photos as a website") + a built-in book designer that **Fundy / Pixellu SmartAlbums** charge $290–480/yr for as desktop software.

---

## 2. What exists today (audit → keep / cut / refactor)

The repo is further along than a from-scratch estimate would assume. The gallery hosting spine works; the liability is that both the data model and the editor are shaped around the abandoned "designed-for-you wedding album" business.

| Subsystem | State | Verdict |
|---|---|---|
| **R2 storage layer** (`src/lib/galleries/r2.ts`) | Working; `forcePathStyle`, signed GET/PUT, multipart | **KEEP** — this is the spine |
| **Signed-URL access** (`src/lib/galleries/access.ts`) | scrypt password hash, TTL access token, cookie | **KEEP → EXTEND** for public/unlisted visibility |
| **Resumable uploader** (`galleries/[id]/gallery-uploader.tsx`, `api/galleries/[id]/uploads`) | R2 multipart, resumable | **KEEP** — the switching-critical feature |
| **Auth** (Supabase magic link, `src/lib/supabase`) | Working | **KEEP** — just open signup to everyone |
| **Brand system** (monochrome, Cormorant + Jost, `CLAUDE.md`) | Working | **KEEP** — decide if it survives the audience widening (§11 open Q) |
| **Public gallery page** (`app/g/[slug]/page.tsx`) | Square grid, `noindex`, signed URLs, admin client | **REFACTOR** — add visibility, real layouts, lightbox, SEO for public |
| **Galleries schema** (`gallery_photos`, `galleries`, `photographer_accounts`, `gallery_favorites`) | B2B-only; `photographer_accounts` | **REFACTOR** — generalize accounts, add visibility + dimensions |
| **Album engine** (`src/lib/engine/`: 23 templates, validation, assignment; unit-tested) | Strong, pure, UI/DB-free | **KEEP → EXTEND** (book designer core) |
| **SpreadRenderer** (`src/components/spreads/`) | Single WYSIWYG renderer, fraction-based rects | **KEEP** — load-bearing; the print-parity guarantee |
| **Album editor** (`app/albums/[id]/edit/album-editor.tsx`) | Single-select, pan-only crop, `Snapshot` undo, **coupled to wedding AI** (`EditorPhoto` has `heroPotential`, `isCouplePortrait`, `stage`, `emotion`) | **REBUILD** per `DESIGNER_SPEC.md` §3–4; decouple from wedding analysis |
| **Print pipeline** (Puppeteer → `page.screenshot()`) | Built at commit `b418a74` (Miller's spec) | **KEEP → VERIFY** against the generalized designer |
| **Wedding-studio flow** (brief, studio queue, proof rounds, `staff` table, `/studio`, AI analysis/generate) | Built for the dead business | **CUT / ARCHIVE** — see §10 |

**Bottom line:** building on it saves the two hardest things (R2 multipart upload and the single-renderer print-parity architecture) and the two most tedious (auth, brand). The work is a *re-shaping*, not a rewrite.

---

## 3. Architecture at a glance

```
                         ┌─────────────────────────────────────────┐
                         │              Next.js (App Router)          │
   Browser ──────────────▶  Vercel — SSR/ISR public pages,           │
   (visitor / owner)     │   server actions, signed-URL issuer,       │
                         │   upload orchestration, ZIP streamer       │
                         └───────┬───────────────────────┬───────────┘
                                 │                        │
                    metadata + auth            object read/write (S3 API)
                                 │                        │
                    ┌────────────▼─────────┐    ┌─────────▼──────────────┐
                    │  Supabase             │    │  Cloudflare R2          │
                    │  • Auth (magic link)  │    │  • originals (private)  │
                    │  • Postgres (RLS on   │    │  • zero egress          │
                    │    all metadata)      │    │  • multipart uploads    │
                    └───────────────────────┘    └─────────┬──────────────┘
                                                            │ remote-image transform
                                                  ┌─────────▼──────────────┐
                                                  │ Cloudflare Images        │
                                                  │ transformations (resize, │
                                                  │ format, quality) — edge   │
                                                  │ cached, egress-free       │
                                                  └───────────────────────────┘
```

Three vendors, each doing the one thing it's best at: **Supabase** = identity + system-of-record metadata (with RLS); **R2** = cheap durable object storage with free egress; **Cloudflare Images transformations** = on-the-fly derivatives at the edge. Next.js on Vercel is the brain that ties them together and is the *only* place access decisions are made.

The single most important architectural rule, inherited from `HOSTING_SPEC.md §3` and unchanged: **files in R2 are not protected by Supabase RLS.** Every object reaches a browser either as a short-TTL signed URL (private) or a public transform URL (public) — and *which one* is an access decision made in app code. This is the #1 security surface (§8).

---

## 4. The core reframe: visibility as a first-class concept

Today a gallery is implicitly private (slug + optional password, `noindex`). The "both, equally" decision means visibility becomes an explicit property with three values, and it drives rendering, URL strategy, and SEO:

| Visibility | Who can view | Discoverable? | Image URLs | Rendering |
|---|---|---|---|---|
| **Private** | Link holders; PIN/password optional | No — `noindex`, no sitemap | Short-TTL **signed** URLs | SSR, per-request, no cache |
| **Unlisted** | Anyone with the link | No — `noindex`, not in sitemap | Public transform URLs (unguessable key) | ISR / cacheable |
| **Public** | Everyone | **Yes** — indexed, in sitemap, on owner's profile | Public transform URLs | SSG/ISR, full SEO |

This single field is what lets one codebase serve both the Pixieset job (private) and the SmugMug job (public portfolio) without forking. Owners also get a **public profile** at `/@handle` that lists their public galleries — the "my photos as a website" surface.

---

## 5. Data model (proposed changes)

Generalize the B2B schema into a universal one. Migration path is additive where possible (rename + backfill), destructive only for the wedding tables (§10).

```sql
-- accounts: one row per signed-up user. Replaces photographer_accounts.
-- Everyone gets one on first login (trigger), pro or consumer.
accounts (
  user_id     uuid primary key,           -- = auth.users.id
  handle      citext unique,              -- public profile @handle; nullable until claimed
  display_name text,
  avatar_key  text,                        -- R2 key
  account_type text default 'personal',    -- 'personal' | 'pro'  (affects defaults/UI, not access)
  plan        text default 'free',          -- config-driven, src/lib/plans.ts
  created_at  timestamptz default now()
)

galleries (
  id            uuid primary key,
  owner_id      uuid references accounts(user_id) on delete cascade,  -- was photographer_id
  title         text not null,
  slug          text unique not null,       -- capability for private/unlisted
  visibility    text not null default 'private',  -- 'private' | 'unlisted' | 'public'  ← NEW
  password_hash text,                        -- private only
  download_pin  text,                        -- 4-digit, optional
  cover_photo_id uuid,
  layout        text default 'justified',    -- 'justified' | 'masonry' | 'grid' | 'story'  ← NEW
  theme         jsonb default '{}',          -- accent, spacing, cover style (branding)  ← NEW
  event_date    date,
  expires_at    timestamptz,                 -- owner-set only; never punitive
  indexed_at    timestamptz,                 -- for sitemap freshness (public)  ← NEW
  created_at    timestamptz default now()
)

gallery_photos (
  id          uuid primary key,
  gallery_id  uuid references galleries(id) on delete cascade,
  r2_key      text not null,                 -- original
  filename    text not null,
  size_bytes  bigint not null,
  width       int not null,                  -- REQUIRED now (justified layout needs aspect ratio)  ← was nullable
  height      int not null,                  -- REQUIRED now  ← was nullable
  blurhash    text,                          -- LQIP placeholder, computed on ingest  ← NEW
  position    int not null,
  taken_at    timestamptz,                   -- EXIF, for chronological sort  ← NEW
  created_at  timestamptz default now()
)

gallery_favorites ( … unchanged … )          -- keep: per-visitor-token favorites

-- Print book designer (generalizes today's albums/spreads; §7)
albums  ( id, owner_id, title, size, cover jsonb, source_gallery_id, status, created_at )
spreads ( id, album_id, position, template_code, frames jsonb, created_at )   -- frames = normalized geometry
orders  ( id, album_id, stripe_session_id, size, qty, shipping jsonb, status, print_file_key )
```

Key changes from today: `photographer_accounts → accounts` with a public `handle`; `galleries.visibility` / `layout` / `theme`; `gallery_photos.width/height` become **required** (the justified layout math needs aspect ratios *before* images load, and today they're nullable); add `blurhash` and `taken_at` computed at ingest. RLS stays on all metadata exactly as today (owner-scoped), with a **public-read policy** added for `visibility = 'public'` rows so public pages can be statically generated without the admin client.

---

## 6. Display system — "beautifully" (the SmugMug/Pixieset surface)

This is the part that makes photos "look expensive," and it's mostly rendering + presets, not a heavyweight editor. Research pass (2026-07-21) landed on a small, boring, proven stack over anything custom.

**Layout — `react-photo-album`.** SSR-friendly, supports **rows (justified)**, **columns**, and **masonry** with a Knuth–Plass-style row-height algorithm (the "justified" look Flickr/SmugMug use). It takes photo dimensions as input and lays out *before* images load — which is exactly why `width`/`height` become required columns (§5). Supports responsive `srcset` natively. ([react-photo-album.com](https://react-photo-album.com/), [ReactScript 2026 roundup](https://reactscript.com/best-image-gallery/))

**Lightbox — PhotoSwipe.** The standard for full-screen viewing: smooth touch gestures, pinch-zoom, keyboard nav, mobile-first. Wrap it once. ([LogRocket comparison](https://blog.logrocket.com/comparing-the-top-3-react-lightbox-libraries/), [lightGallery 2026 list](https://www.lightgalleryjs.com/blog/7-best-react-image-gallery-libraries/))

**Placeholders — BlurHash / LQIP.** Compute a tiny blur string per photo on ingest (store in `gallery_photos.blurhash`); render it instantly so the grid paints with no layout shift while the real image streams in. This is the single biggest "feels premium" lever for the money.

**Responsive images — Cloudflare Images transformations over R2.** Do **not** ship originals to browsers. Serve derivatives via Cloudflare's remote-image transformations pointed at R2: resize/format/quality per breakpoint, edge-cached, **egress-free**. Pricing model to design against: first **5,000 unique transformations/month free**, then **$0.50 per 1,000** on Images Paid (a variant = one unique transform, cached forever after). Define a fixed **variant ladder** (e.g. 320 / 640 / 1024 / 2048 / 3840 px, `format=auto` → AVIF/WebP, `quality≈82`) so unique-transform count is bounded by *distinct sizes*, not traffic. ([Cloudflare Images pricing](https://developers.cloudflare.com/images/pricing/), [R2 pricing](https://developers.cloudflare.com/r2/pricing/), [theimagecdn analysis](https://theimagecdn.com/docs/cloudflare-images-pricing))

**Public vs private delivery split (the one subtlety):**
- **Public / unlisted:** transform URLs are cacheable and can be served directly — cheap, fast, edge-cached, SEO-friendly. Page can be SSG/ISR.
- **Private:** transforms must sit behind the signed-URL layer so cached derivatives don't leak. Either sign the transform URL or proxy through a Next route that checks access then 302s to a short-TTL URL. Private galleries lose edge-cacheability by design — correct trade-off.

**Rendering strategy by visibility:** public → `generateStaticParams` + ISR + full metadata/OpenGraph + `sitemap.ts` entry; unlisted → ISR, `noindex`; private → SSR per request, `noindex`, current pattern. The existing `app/g/[slug]/page.tsx` becomes the private branch; add a public branch (`/@handle/[gallerySlug]` or keep `/g/[slug]` and switch on visibility).

**Themes/branding (v1, light):** accent color, cover style (full-bleed hero vs. centered), grid density, logo — stored in `galleries.theme` jsonb. This is "beautiful presets," not a page builder. Custom domains are fast-follow (SmugMug's headline feature, but a CNAME + cert-on-demand project on its own).

---

## 7. The album creator — print photo-book designer

This is the "album creator built in," and the good news is the hard architecture is already decided and partly built. Follow `DESIGNER_SPEC.md` (approved 2026-07-20) — I'm not relitigating it, only situating it in the new product.

**What changes from that spec given the pivot:** the designer must be **decoupled from the wedding AI**. Today `EditorPhoto` carries `heroPotential`, `isCouplePortrait`, `stage`, `emotion` — wedding-analysis fields. In the platform, the book designer's input is *any* gallery's photos: `{ id, url, width, height, takenAt }`. Strip the wedding semantics; keep the geometry engine.

**Keep (already right):**
- The **pure engine** (`src/lib/engine/`) — 23 templates as normalized geometry, validated, unit-tested, zero UI/DB coupling.
- The **single `SpreadRenderer`** — same component draws editor, preview, and print. This is what guarantees WYSIWYG print parity and is the rare thing pro tools get wrong.
- The **print pipeline** — Puppeteer mounting `SpreadRenderer` at exact print pixels and capturing with `page.screenshot()` (verified: `page.pdf()` ignores `deviceScaleFactor`; screenshot honors it). Already built at Miller's spec.

**Rebuild (per `DESIGNER_SPEC.md §3–4`):** normalized state store + command/patch history (album-wide undo); multi-select + marquee; zoom-in-frame crop (transform model, not pan-only); unified cross-spread drag; canvas-free DOM/CSS + one SVG overlay for guides/handles. Konva stays the documented escape hatch, not the default.

**How it connects to hosting:** a book is created **from a gallery** (`albums.source_gallery_id`). Flow: pick a gallery → "Make a book" → choose size → auto-draft via templates (later, the dormant AI layout engine as an internal drafting tool) → refine in the designer → export print-ready file / order print. Because photos already live in R2 at full res, the designer only ever loads web-res in the browser and composites originals **server-side at print time** — the normalized 0–1 geometry makes that exact.

**Sequencing note:** the designer is a big build. It should come *after* the display/hosting surface is solid (that's the daily-use product for "anyone with photos"), matching `DESIGNER_SPEC.md`'s own "print pipeline first, then workspace" ordering.

---

## 8. Access control & security (the #1 surface)

Restating the load-bearing rule because it's where this class of product leaks: **R2 has no RLS; app code is the only guard.** Concretely:

1. **Never expose a raw R2 URL.** Browsers get signed URLs (private) or public transform URLs (public) — issued only after the visibility/access check.
2. **Signed URLs are short-TTL** (minutes) and issued per request for private galleries; never logged, never in query strings that get cached.
3. **Password/PIN** verified server-side (scrypt, existing `access.ts`); access token in an httpOnly cookie scoped to the gallery id (existing pattern).
4. **Public-read RLS policy** for `visibility='public'` rows only — so static generation never touches the service-role key. The admin/service client stays server-only and is used *only* for private/unlisted where RLS can't express the rule.
5. **Downloads/ZIP** stream through a server route that re-checks access and pulls from R2 with the server credential — the client never sees a bulk credential.
6. **Enumeration:** slugs and unlisted keys must be unguessable (already the case); public handles are intentionally guessable but only expose public galleries.

Every one of these is a test case, not a hope. This section is the thing to code-review hardest.

---

## 9. Upload & ingest pipeline

Keep the resumable R2 multipart uploader (the switching-critical feature). Extend the **ingest** step, which currently just stores the object:

1. Client uploads original → R2 (multipart, resumable, 2–3 parallel, per-file retry). **Already works.**
2. On completion, a server step reads image dimensions + EXIF (`sharp`, already a dependency), writes `width`/`height`/`taken_at`/`blurhash` to `gallery_photos`. **New — required for layout + LQIP.**
3. **No pre-generated thumbnails needed** — Cloudflare Images transforms on demand from the original. (This deletes the current `thumb_key` generation path; simpler and cheaper.)
4. HEIC accepted; `sharp` transcodes to a web-safe original or the transform layer handles it — validate on iOS Safari before calling it done (the historical bar).

The one behavioral change worth calling out: today's code generates and stores a square `thumb_key`. Moving to on-the-fly transforms means **originals only** in R2 + a variant ladder at the edge — less storage, less ingest work, infinitely flexible sizes.

---

## 10. What to cut or archive (wedding baggage)

The "designed-for-you wedding album" business is gone; its code shouldn't shape the platform. Recommend a single "de-wedding" PR that archives (git history preserves it) or deletes:

- `/studio` routes + `staff` table + designer-queue flow.
- The wedding **brief** (`brief-form.tsx`, `src/lib/albums/brief.ts`), **proof rounds**, and the `uploading → briefing → in_design → proof_ready ⇄ in_revision → approved` status machine.
- **AI analysis/generate** endpoints (`api/albums/[id]/analyze`, `/generate`) and the wedding-semantic fields on `EditorPhoto`. *Keep the layout-engine prompt scaffolding dormant* — it's the future auto-draft tool (`DESIGNER_SPEC.md §D5`), just not wedding-coupled.
- Wedding-specific copy/marketing on the landing surfaces.

Keep everything in §2's "KEEP" rows. The engine and renderer are business-agnostic already; they just need the wedding *inputs* stripped.

---

## 11. Build phases

Sequenced so every phase ends in something you can click. Assumes build-on-existing.

**P0 — De-wedding + generalize accounts (foundation).**
Open signup to everyone; `photographer_accounts → accounts` with `handle`; cut the studio/brief/proof flow (§10). Ends: anyone can sign up and land on a dashboard.

**P1 — Visibility + public rendering.**
Add `galleries.visibility`; split the gallery page into private (SSR, signed, noindex — today's code) and public (ISR, transform URLs, SEO, sitemap) branches; public profile `/@handle`. Ends: you can publish a public gallery that shows up in Google, and a private one that doesn't.

**P2 — Beautiful display.**
`react-photo-album` (justified/masonry) + PhotoSwipe lightbox + BlurHash placeholders + Cloudflare Images variant ladder + responsive `srcset`. Ingest step computes dimensions/EXIF/blurhash (§9). Ends: galleries look like the reference sites, fast, on mobile.

**P3 — Client-delivery must-haves.**
Favorites (schema exists), full-res + web-res downloads, full-gallery **ZIP** streaming, 4-digit PIN, gallery-ready email, light theming/branding. Ends: a wedding photographer could actually deliver a job.

**P4 — Billing.**
Stripe subscriptions, plan enforcement (`src/lib/plans.ts`), soft-cap warnings (never silent delete). Shared with any future print-order checkout. Ends: people can pay.

**P5 — Album designer v1 (print book).**
Per `DESIGNER_SPEC.md`: verify print pipeline against generalized inputs → reopen the editor decoupled from wedding AI → normalized state + multi-select + zoom-crop. Ends: any gallery → a print-ready book.

**P6+ — Fast-follows.**
Custom domains, white-label, slideshow layout, gallery analytics, Lightroom plugin, AI auto-draft for the book designer.

---

## 12. Open questions for Alex

1. **Brand.** `CLAUDE.md` mandates a strict monochrome, Cormorant/Jost, dark-first wedding-editorial system. For "anyone with photos," does that stay (it's distinctive and cheap to keep), or does the audience widening call for a lighter/neutral chrome that gets out of the photos' way? *Recommendation: keep it for v1 — it's a differentiator and the photos are the only color anyway.*
2. **Consumer vs pro emphasis at launch.** Open signup is decided, but who does the *marketing site* speak to first? It changes copy, not architecture.
3. **Commerce.** Selling prints/downloads to *clients* (SmugMug/Pixieset both do) — in scope later, or never? Affects whether `orders` generalizes beyond your own book sales. *Assumed out of v1.*
4. **Handle/profile at signup** — required (claims `/@handle` immediately) or optional until they go public? *Recommendation: optional; claim on first public publish.*
5. **RAW / video.** Out of scope per `HOSTING_SPEC.md` (route video to Vimeo/Drive). Confirm still true.

---

## 13. Risks

1. **Signed-URL layer done sloppily → private gallery leak.** Highest severity; the whole private side depends on it. Test-driven, code-reviewed, adversarially.
2. **Cloudflare Images unique-transform sprawl.** Undisciplined sizes blow past the 5k free tier fast. Enforce a *fixed* variant ladder; treat "arbitrary on-the-fly dimensions" as a bug.
3. **Public/private cache bleed.** A cached public transform of what should be a private image = leak. The delivery split (§6) must be structural, not per-call discipline.
4. **Designer scope.** It's the biggest build here; `DESIGNER_SPEC.md`'s "print pipeline first" ordering exists to de-risk it. Don't start it before P2–P3 ship.
5. **Two-vendor ops** (Supabase + Cloudflare): billing, monitoring, failure modes across both.
6. **Layout needs dimensions** — any photo missing `width/height` breaks justified layout. Backfill existing rows; make it required at ingest.

---

## 14. Recommended dependencies (net-new)

| Purpose | Pick | Notes |
|---|---|---|
| Justified/masonry layout | `react-photo-album` | SSR, responsive, dimension-driven |
| Lightbox | `photoswipe` (+ thin React wrapper) | Touch/zoom/keyboard, mobile-first |
| LQIP placeholder | `blurhash` (encode server-side with `sharp`) | Store string on ingest |
| Image derivatives | Cloudflare Images transformations | Already in the Cloudflare account; point at R2 |
| Billing | `stripe` | Shared with print orders (P4) |

Already present and reused: `@aws-sdk/client-s3` + presigner (R2), `sharp` (ingest), `@dnd-kit/*` (designer), `puppeteer` (print), `tus-js-client`/multipart (upload), Supabase SSR/auth.

---

*Sources (research pass 2026-07-21): [Cloudflare Images pricing](https://developers.cloudflare.com/images/pricing/) · [Cloudflare R2 pricing](https://developers.cloudflare.com/r2/pricing/) · [Cloudflare Images pricing analysis](https://theimagecdn.com/docs/cloudflare-images-pricing) · [react-photo-album](https://react-photo-album.com/) · [ReactScript gallery roundup 2026](https://reactscript.com/best-image-gallery/) · [LogRocket lightbox comparison](https://blog.logrocket.com/comparing-the-top-3-react-lightbox-libraries/) · [lightGallery: 7 best React gallery libraries](https://www.lightgalleryjs.com/blog/7-best-react-image-gallery-libraries/). Internal: `HOSTING_SPEC.md`, `DESIGNER_SPEC.md`, `CLAUDE.md`, repo audit at commit `23e6949`.*
