-- Layout-plan support (Phase 2).

-- Why a photo was left off the album. Written by the layout engine, shown in
-- the editor's "We set these aside" tray. Null means the photo is placed (or
-- the plan hasn't run yet). Deliberately NOT inside analysis jsonb — analysis
-- is the immutable vision output; this is a layout decision that changes on
-- regenerate.
alter table public.photos
  add column set_aside_reason text;

-- The one full-album regenerate (cost guardrail from CLAUDE.md). Spreads
-- already carry their own 0–3 regen_count.
alter table public.albums
  add column regen_count integer not null default 0
    check (regen_count between 0 and 1);
