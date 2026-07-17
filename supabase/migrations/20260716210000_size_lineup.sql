-- Size lineup v2 (Alex, 2026-07-16, informed by the competitive research):
-- 10x10 (hero), 12x12, 11x14. 8x8 is dropped from the product but the enum
-- value stays — Postgres can't remove enum values, and a legacy value that
-- nothing offers is harmless.
alter type public.album_size add value if not exists '11x14';
