-- =============================================================================
-- PLATFORM_SPEC.md P2: the display system needs real geometry.
--
-- Justified layout computes row heights from aspect ratios BEFORE images load,
-- so width/height stop being optional. blurhash paints an instant placeholder
-- (no layout shift); taken_at powers chronological ordering and the Smart
-- Arrange pass. Columns are added nullable here and backfilled by
-- scripts/backfill-dimensions.mjs; NOT NULL follows once no rows are missing.
-- =============================================================================

alter table public.gallery_photos
  add column blurhash text,
  add column taken_at timestamptz;

create index gallery_photos_taken_at_idx
  on public.gallery_photos (gallery_id, taken_at);
