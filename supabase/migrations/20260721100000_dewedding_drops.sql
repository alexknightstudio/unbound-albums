-- =============================================================================
-- PLATFORM_SPEC.md P0 (destructive half) — approved by Alex 2026-07-21.
--
-- Drops the wedding-studio machinery: staff, proof rounds, and the old
-- photographer_accounts (superseded by accounts). The dormant album tables
-- (albums / spreads / photos) are deliberately KEPT — the print pipeline reads
-- them today and the P5 book designer generalizes them.
-- =============================================================================

-- Policies that depend on is_staff() go first.
drop policy if exists "staff read all albums" on public.albums;
drop policy if exists "staff update albums" on public.albums;
drop policy if exists "staff read all photos" on public.photos;
drop policy if exists "staff read originals" on storage.objects;
drop policy if exists "staff read thumbs" on storage.objects;
drop policy if exists "staff upload proof images" on storage.objects;
drop policy if exists "couples and staff read proof images" on storage.objects;

-- Proof rounds (policies drop with their tables).
drop table if exists public.revision_notes;
drop table if exists public.proof_pages;
drop table if exists public.proofs;

-- Staff.
drop table if exists public.staff;
drop function if exists public.is_staff();

-- The old B2B account table — superseded by accounts (backfilled 20260721090000).
drop table if exists public.photographer_accounts;
