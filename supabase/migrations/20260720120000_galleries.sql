-- =============================================================================
-- Unbound Galleries — B2B client-gallery hosting (HOSTING_SPEC.md, approved
-- 2026-07-20). v0 slice: photographers, galleries, photos metadata.
--
-- Files live in Cloudflare R2, NOT Supabase Storage — so RLS here guards
-- METADATA only. File access is enforced in app code via short-TTL signed
-- URLs issued after a session/access check (the spec's #1 security surface).
-- Public gallery reads go through server routes using the admin client after
-- slug + password verification; anon roles get no direct table access.
-- =============================================================================

-- Photographers are customers (not staff). One row per user who activates
-- the hosting product.
create table public.photographer_accounts (
  user_id uuid primary key,
  business_name text not null check (char_length(business_name) between 1 and 120),
  -- Plan is config-driven (src/lib/galleries/plans.ts); text keeps it loose
  -- until billing lands.
  plan text not null default 'solo',
  created_at timestamptz not null default now()
);

alter table public.photographer_accounts enable row level security;

create policy "photographers manage their own account"
  on public.photographer_accounts for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create table public.galleries (
  id uuid primary key default gen_random_uuid(),
  photographer_id uuid not null references public.photographer_accounts (user_id) on delete cascade,
  title text not null check (char_length(title) between 1 and 160),
  -- The share capability. Unguessable, like album share_slugs.
  slug text not null unique,
  -- scrypt hash (src/lib/galleries/access.ts); null = link-only access.
  password_hash text,
  event_date date,
  cover_photo_id uuid,
  -- Optional 4-digit download PIN (feature-floor must-have; wired later).
  download_pin text check (download_pin is null or download_pin ~ '^[0-9]{4}$'),
  -- Photographer-set expiry only. Default NONE — never punitive deletion.
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create index galleries_photographer_idx on public.galleries (photographer_id, created_at);

alter table public.galleries enable row level security;

create policy "photographers manage their own galleries"
  on public.galleries for all
  to authenticated
  using (photographer_id = auth.uid())
  with check (photographer_id = auth.uid());

create table public.gallery_photos (
  id uuid primary key default gen_random_uuid(),
  gallery_id uuid not null references public.galleries (id) on delete cascade,
  -- R2 object keys (originals and generated thumb). Bucket-relative.
  r2_key text not null,
  thumb_key text,
  filename text not null,
  size_bytes bigint not null check (size_bytes > 0),
  width int,
  height int,
  position int not null,
  created_at timestamptz not null default now(),
  unique (gallery_id, position)
);

create index gallery_photos_gallery_idx on public.gallery_photos (gallery_id, position);

alter table public.gallery_photos enable row level security;

create policy "photographers manage their own gallery photos"
  on public.gallery_photos for all
  to authenticated
  using (
    exists (
      select 1 from public.galleries g
      where g.id = gallery_photos.gallery_id and g.photographer_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.galleries g
      where g.id = gallery_photos.gallery_id and g.photographer_id = auth.uid()
    )
  );

-- Client favorites — stored per gallery visitor session token (no client
-- accounts). Wired in the favorites feature; table exists so the uploader
-- slice doesn't need a second migration.
create table public.gallery_favorites (
  id uuid primary key default gen_random_uuid(),
  gallery_id uuid not null references public.galleries (id) on delete cascade,
  photo_id uuid not null references public.gallery_photos (id) on delete cascade,
  visitor text not null,
  created_at timestamptz not null default now(),
  unique (gallery_id, photo_id, visitor)
);

alter table public.gallery_favorites enable row level security;

create policy "photographers read their gallery favorites"
  on public.gallery_favorites for select
  to authenticated
  using (
    exists (
      select 1 from public.galleries g
      where g.id = gallery_favorites.gallery_id and g.photographer_id = auth.uid()
    )
  );
