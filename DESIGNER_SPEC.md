# DESIGNER_SPEC.md — The Unbound Album Designer (web-based, professional)

*Research synthesis, 2026-07-20. Three research passes: read-only audit of the existing (dormant) editor code, technical comparison of canvas approaches (verified July-2026 library states), and a UX catalog of Fundy Designer / Pixellu SmartAlbums / AlbumStomp. No code written; this is the spec to approve.*

## 1. Who it's for, in order

1. **Unbound's own hired designers** — replacing their external tools (SmartAlbums bundle ≈ $40/mo/seat; Fundy Pro lease $290/yr). Even 2–3 seats replaced pays real money, and it collapses the studio workflow: today's design → export → upload-to-proof dance becomes design → click "Deliver proof."
2. **B2B photographers later** — the same tool, packaged. (Fundy/Pixellu charge $290–480/yr for desktop software; a web-native designer wired to hosting galleries — see HOSTING_SPEC.md — is a genuinely differentiated bundle.)

## 2. What we already have (audit findings)

**Genuinely strong, keep:**
- **The single-renderer WYSIWYG principle** — one `SpreadRenderer` (fraction-based rects, DOM/CSS, `object-fit/position`) draws editor, preview, share, and (planned) print identically. This is the rare load-bearing decision that pro tools need and we already got right.
- **The pure engine** (`lib/engine/`): 23 templates as geometry data, validation, assignment — zero UI/DB coupling, fully unit-tested.
- **The mutation pipeline shape**: optimistic apply → server action → server-side re-validation against fresh DB state → rollback on failure. Right pattern for a multi-writer future.
- **The perf tricks**: direct-DOM hot path for crop drag (bypass React during gestures, commit on pointer-up); the atomic reorder RPC (deferrable constraint).

**Limits to respect (what makes today's editor a couple's toy, not a pro tool):**
- Single flat `useState` state model; selection is exactly one item — no multi-select, no marquee, no cross-spread clipboard.
- Crop is pan-only (no zoom-in-frame, no rotation); the direct-DOM trick is wired to one `<img>` by selector.
- Two disconnected dnd-kit contexts — no cross-spread photo drag.
- Templates are a closed catalog of 23 — no free-form frame placement, no z-order, no rotation field in the data model.
- Editing is gated on the legacy `ready` status — functionally unreachable post-pivot.
- **The 300-DPI print pipeline does not exist.** Zero Puppeteer/PDF code or dependencies — it was only ever a Phase 5 plan. The `print` bucket and `orders.print_pdf_path` column exist, unwritten.

## 3. Architecture decision: canvas-free — evolved DOM/CSS + SVG overlay

Verified against konva.js (react-konva 19.2.5), fabric.js (7.4.0), and raw canvas (July 2026):

- **Frames & images:** absolutely-positioned DOM; frame = `overflow:hidden`, image = transformed child (`translate/scale`) → crop/pan/zoom-in-frame is GPU-composited transform math. Whole-spread `transform: scale()` container gives 60fps canvas zoom/pan for free at our scale (15 spreads, ~20 web-res images each).
- **Guides, snap, selection handles:** one absolutely-positioned **SVG overlay** — sharp monochrome vectors, no canvas context. Snap math (edges/centers/spacing) is geometry code independent of renderer.
- **Drag & drop:** dnd-kit (already chosen), extended to cross-spread and tray→frame.
- **Text:** real DOM text. For a Cormorant-Garamond brand this is decisive — browser kerning/ligatures/hinting, identical on screen and in print. Canvas text is the weakest link of Konva/Fabric and the hardest to keep parity on.
- **State:** normalized store (Zustand-class) — spreads/frames/selection-as-a-set — with **command/patch history** (Immer patches) for album-wide undo. The renderer becomes a pure function of state; history stores ops, never snapshots of pixels. This replaces the whole-spread Snapshot model.
- **Print: the same renderer, screenshot, not PDF.** Mount `SpreadRenderer` at exact print pixels (Miller's: spread-width × 250 DPI — e.g. 10×10 book → 5000×2500px) in Puppeteer and capture with `page.screenshot()`. **Verified: Puppeteer's `page.pdf()` ignores `deviceScaleFactor`; `page.screenshot()` honors viewport pixels — and Miller's wants flat raster files, not PDF.** Same component, same fonts, same crop math, same rasterizer → parity is structural, not tested-and-hoped. All crop/frame math stays **normalized (0–1)**; originals are composited only server-side at print time (browser only ever sees web-res).

**Why not Konva:** it earns nothing on the two criteria that matter most (print parity — its server path renders through Cairo, a different rasterizer; typography), adds a single-maintainer dependency pinned to React versions, and our workload is far below where its scene-graph advantages appear. **Fabric.js eliminated** (full-canvas redraws, no React story, documented node-canvas leaks). Konva is the documented escape hatch if scope ever demands true layer effects/rotation-heavy freeform art — the state-first architecture keeps the renderer swappable.

## 4. Migration path from current code

| Subsystem | Verdict | Action |
|---|---|---|
| SpreadRenderer | KEEP | Add `renderScale`; later extend SlotRect → arbitrary per-frame rects (same 0–1 coordinate system) |
| Engine/templates | KEEP → EXTEND | Templates become *starting points*; add a free-frame mode writing the same fractional geometry |
| State | REBUILD | Normalized store + command history + multi-select |
| Crop | REBUILD | Transform model (translate/scale per image, zoom-in-frame); keep the bypass-React-during-gesture technique, generalized |
| DnD | EXTEND | Unify contexts; cross-spread + tray→frame |
| Persistence | EXTEND | Keep optimistic+rollback; batch continuous gestures (commit-on-pointer-up everywhere); debounced autosave |
| Access | CHANGE | Editor gating moves from legacy `ready` status to **staff/designer role** |
| Print | BUILD NEW | §5 Phase D1 |

## 5. Phased roadmap

**D1 — Print pipeline first (1 phase, before any editor work).**
Puppeteer + `page.screenshot()` over the existing SpreadRenderer at Miller's spec; golden-image regression test (pinned Chromium, embedded fonts); validate the largest size (11×14 → 7000×3500px) against Puppeteer's large-capture limits first. *Why first: it de-risks the architecture's central claim, and it's revenue — print files are what the $99 download and every print order need. It pays for itself before the designer UI exists.*

**D2 — Designer workspace v1 (staff-only, template-based).**
Re-open the dormant editor for the designer role. Add the cheap professional-feel wins from the UX research: Miller's safe-zone/centerfold guides drawn on canvas (S); DPI warning badge on under-filled frames (S); used/unused + "N of 150 placed" counter (S — a gap neither Fundy nor Pixellu fills well); EXIF chronology sort (S); cross-spread drag (S–M); template picker filtered by count/orientation (M — seeded by our 23 templates).

**D3 — Pro layout tools.**
Zoom-in-frame crop + new transform model; multi-select; snap/alignment guides + spacing controls (SVG overlay); command-pattern undo; batched autosave.

**D4 — Close the studio loop.**
"Deliver proof" from inside the designer: server renders spreads via the D1 pipeline directly into a proof round (no export/upload). The existing proof_ready ⇄ in_revision flow already matches the Fundy Proofer / Pixellu Cloud pattern (link → per-spread comments → revisions → explicit approve) — designers just stop leaving the app. Revision notes shown in-canvas next to the spread they reference.

**D5 — Superpowers (later).**
Auto-build: the dormant AI layout engine *is* SmartAlbums' headline feature (metadata-driven spread generation) — reactivate as an internal draft tool feeding D2's workspace. Face-aware auto-crop from the existing analysis pipeline. Free-form frames (arbitrary rects/z-order) only if template-mode proves insufficient for the studio. B2B packaging (accounts, billing, onboarding) only after the studio has lived in it.

## 6. Risks

1. **Large Puppeteer captures**: 11×14 at 250 DPI ≈ 7000×3500px; documented failures >6000px in some configurations — validate in D1 week one; tiling fallback if needed.
2. **Font/environment drift**: parity requires pinned Chromium + embedded brand fonts + golden-image diffs in CI.
3. **Normalized-math purity**: one leaked pixel constant breaks print parity — enforce 0–1 types, test display-scale vs print-scale renders for identical composition.
4. **Effects creep**: CSS filters/shadows at scale would break the 60fps budget — the monochrome brand helps; "we need layer effects" is the explicit Konva-reconsideration trigger.
5. **Mobile memory**: lazy-mount spreads, web-res only in browser, test on a real iPhone.

## 7. Open decisions for Alex

**APPROVED in full, 2026-07-20:** canvas-free architecture ✓ · print-pipeline-first ✓ · in-house-first scope ✓.
