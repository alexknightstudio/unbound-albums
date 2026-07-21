-- =============================================================================
-- PLATFORM_SPEC.md P1: visibility as a first-class concept (§4).
--
-- private  — link holders, optional password; noindex; signed URLs
-- unlisted — anyone with the link; noindex; slug stays the capability
-- public   — indexed, sitemapped, on the owner's /@handle profile
--
-- Public-read RLS applies ONLY to visibility='public' rows (they're in the
-- sitemap anyway — enumeration is the point). Unlisted rows are deliberately
-- NOT anon-readable: a policy would let the anon key list every unlisted
-- slug via PostgREST, destroying the capability. Unlisted stays server-side.
-- =============================================================================

alter table public.galleries
  add column visibility text not null default 'private'
    check (visibility in ('private', 'unlisted', 'public')),
  add column indexed_at timestamptz;

create index galleries_public_idx on public.galleries (visibility)
  where visibility = 'public';

-- Public galleries are readable by everyone — pages can render without the
-- service key (spec §8.4).
create policy "anyone reads public galleries"
  on public.galleries for select
  to anon, authenticated
  using (visibility = 'public');

create policy "anyone reads public gallery photos"
  on public.gallery_photos for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.galleries g
      where g.id = gallery_photos.gallery_id and g.visibility = 'public'
    )
  );
