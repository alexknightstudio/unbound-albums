# HOSTING_SPEC.md — Unbound Galleries (B2B Client Image Hosting)

*Research synthesis, 2026-07-20. Three research passes: competitor pricing teardown (live pricing pages), storage cost modeling (verified provider pricing), and photographer feature-floor research (competitor docs + switching-complaint analysis). Sources cited in each section. No code has been written; this is the spec to approve.*

## 1. The product in one paragraph

Clean, fast client-gallery hosting for professional photographers — the delivery step, done beautifully, and nothing else. No print store, no AI, no CRM, no email marketing in v1. Positioning attacks the market's two documented sore spots: **pricing that punishes storage** and **platforms that delete client galleries**. Tagline logic: *"Unlimited galleries, unlimited guests, unlimited downloads. You never pay for traffic. And we never delete a gallery without your say-so."* Both claims are literally true under the recommended architecture.

## 2. Market reality (verified 2026-07-20)

- **The unlimited-storage price floor is a settled $40–50/mo band**: Pixieset Ultimate $40 (annual), Pic-Time Advanced $42 (annual), ShootProof Unlimited $50 (annual), CloudSpot Unlimited ~$50 (standing price unverifiable — only a $3/mo promo is published, itself a red flag). Zenfolio Advanced is the $20 outlier, and its complaint pattern (14-month auto-archive, throttled downloads, no bulk export — "cheap until you try to leave") is precisely why.
- **The underserved gap: $12–20/mo for 100–500GB, storage-only.** Every incumbent prices 100GB-class storage at $17–25/mo and bundles store/CRM/marketing surface the photographer didn't ask for. A working wedding photographer (2–3 weddings/month) blows through 100GB and is forced into the $30–50 bracket.
- **Second gap: self-serve small-studio teams.** CloudSpot punts 3+ shooters to "contact us"; nobody offers a clean 2–5 seat tier.
- **Trust is a live wound**: Pic-Time ties gallery deletion to late payment; expired links and studio shutdowns have produced documented lost-photo complaints, BBB cases, and lawsuits. "Never silently delete" is a differentiator, not table stakes.

Full teardown table with per-tier pricing and source URLs: see research appendix (agent output, 2026-07-20 fetch — Pic-Time/ShootProof/Pixieset/CloudSpot/Zenfolio pricing pages).

## 3. Storage architecture — decision: Cloudflare R2 + Cloudflare Images; Supabase stays for auth/db

Verified marginal cost per photographer (July 2026 pricing, worked model: 1TB stored ≈ 20 weddings, ~3 active galleries/month, browsing + full-res ZIP downloads):

| Backend | 1 TB /mo | 5 TB /mo | Notes |
|---|---|---|---|
| **Cloudflare R2** | **~$15.50** | **~$76.65** | $0.015/GB-mo storage, **$0 egress**, transforms $0.50/1k |
| AWS S3 + CloudFront | ~$34.27 | ~$152.55 | $0.085/GB egress dominates |
| Supabase Storage | ~$36.62 | ~$157.08 | $0.09/GB uncached egress + 10× transform cost |

R2 is ~2× cheaper, and decisively: **egress is $0**, so the scariest cost line (80 guests ZIP-downloading a wedding) is free at any volume. Cost scales with storage only. The ZIP-volume ambiguity in the model (40GB vs 400GB per wedding) is catastrophic for the other two backends and irrelevant to R2 — which is itself the argument.

**Architecture:** originals in R2 (S3-compatible API via `@aws-sdk/client-s3`); web-res derivatives via Cloudflare Images ($0.50/1,000 unique transforms), edge-cached; delivery stays inside Cloudflare's pipe (egress-free requires it); galleries untouched 90+ days auto-transition to R2 Infrequent Access (−33% storage cost). Supabase remains the system of record: auth, Postgres (photographers, galleries, photos metadata, access grants), RLS on metadata.

**The two engineering consequences to respect:**
1. **Access control moves from RLS to app code.** Files in R2 are not guarded by Supabase RLS. Every object URL must be short-TTL signed, issued only after a session/access check (Next.js route or Worker). This is the #1 security surface of the product — private galleries leak if this is sloppy.
2. **Resumable uploads must be rebuilt.** We lose Supabase's TUS convenience; R2 multipart upload with resume must meet the existing "bulletproof, survives bad WiFi, iOS Safari" bar. This is the switching-critical feature (see §5) — budget it as real work, not plumbing.

## 4. Pricing recommendation (placeholder-firm, configurable like sizes.ts)

Price storage honestly; make traffic unlimited (the inverse of every incumbent):

| Tier | Price | Included storage | Everything else |
|---|---|---|---|
| **Solo** | **$19/mo** ($15/mo annual) | 500 GB | Unlimited galleries, guests, downloads |
| **Studio** | **$36/mo** ($29/mo annual) | 1.5 TB | + 3 seats (the small-studio gap) |
| **Pro** | **$60/mo** ($48/mo annual) | 3 TB | + priority support |
| Overage | $6 / 100 GB / mo | — | Soft-cap: warn at 90%, explicit opt-in past cap — no surprise bills, no silent deletes |

Margin math at realistic ~40% cap utilization: Solo ~79%, Studio ~72%, Pro ~68% gross. The 10TB hoarder is profitable at overage pricing ($60/TB vs $15/TB cost = 72% margin), so abuse is a non-problem by construction.

**Hard constraint from the model: do NOT promise unlimited storage.** At $15/TB real cost, unlimited at ≤$45 with ≥70% margin is arithmetic that doesn't work — the incumbents' "unlimited" survives on low average use and punitive archiving. Promise unlimited *traffic* instead; it's the promise R2 makes free.

**Deletion policy (the trust differentiator):** galleries are never deleted for non-payment or inactivity without explicit photographer action; a lapsed account freezes uploads, never destroys data; export is always available. This goes in the ToS and on the pricing page.

## 5. v1 feature set (from the feature-floor research)

**MUST-HAVE (v1 ships with all of these):**
- Per-client galleries with shareable link; password protection; noindex-by-default
- Grid layout + cover/hero image (the "looks expensive" moment); mobile-first — most clients open on a phone, and clunky mobile delivery is the #1 cited switching trigger
- Client favorites/selects
- Download controls: full-res + web-res, per-photo and full-ZIP, 4-digit PIN
- Full-res JPEG storage (RAW out of scope — industry delivery norm is edited JPEG)
- Logo + accent-color branding (custom domain is fast-follow)
- Gallery-ready notification email (transactional only)
- Photographer-set expiry as an *option*, default none — never punitive auto-deletion
- **Resumable browser uploader**: folder drag-drop of hundreds-to-thousands of JPEGs, chunked, survives network drops and closed tabs, no per-batch ceiling. This is the switching bar; the Lightroom plugin is a fast-follow wrapper around the same path.

**FAST-FOLLOW:** masonry/slideshow layouts, custom domain, white-label, watermarking, gallery analytics, Lightroom plugin.
**OUT OF SCOPE v1:** print store, email marketing sequences, email-gated access, RAW ingestion, video hosting (photographers already route 50–90GB films through Vimeo/Drive; don't let video dictate the storage architecture).

## 6. Codebase integration

- **New product surface, same repo, same brand system**: `/photographers` marketing page; app routes under a photographer role. Data model: `photographers` (or a role on users), `galleries` (slug, password_hash, settings, expiry, brand), `gallery_photos` (r2_key, width/height, position), `gallery_events` (favorites, downloads). RLS on all metadata as today; file access via the signed-URL layer (§3).
- **Reuse:** auth (magic link), sharp thumbnailing patterns, monochrome brand system, the upload UI patterns (rebuilt against R2 multipart), the share-slug capability model (`/g/[slug]`).
- **Synergy:** once R2 + Cloudflare Images exist, UNBOUND's own album proofs and originals can migrate to the same zero-egress path — the hosting build pays down the album product's future bandwidth bill; and every hosted photographer is a warm B2B channel for the album designer product (see DESIGNER_SPEC.md).
- **Dependency:** billing (Stripe) is required for hosting subscriptions and is also Phase 5 of the album product — build the Stripe integration once, shared.

## 7. Risks

1. Signed-URL access layer done sloppily → private gallery leak (highest severity).
2. R2 multipart resumable upload underestimated → misses the "bulletproof" bar photographers switch for.
3. Egress-free depends on staying inside Cloudflare's delivery pipe — architectural discipline required.
4. Two-vendor ops (Supabase + Cloudflare): billing, monitoring, failure modes.
5. Workload assumptions are modeled, not measured — pin tier caps after real beta usage; all tier numbers live in config.

## 8. Open decisions for Alex

1. **Approve the R2 architecture** (vs. staying all-Supabase for v1 speed at ~2.2× the marginal cost and a punitive ZIP-download exposure). Recommendation: R2 — the egress economics *are* the product.
2. **Approve pricing + the two promises** — "unlimited traffic, never unlimited storage" and the no-deletion policy (a ToS/legal commitment, not just copy). Numbers are placeholders in config until beta data.
3. **Brand & sequencing** — "Unbound Galleries" under the same brand and domain, or separate? And does hosting v1 ship before or after the album product's Stripe work (they share the billing build)?
