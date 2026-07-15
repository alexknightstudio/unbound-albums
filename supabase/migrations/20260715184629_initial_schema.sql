-- =============================================================================
-- Unbound Albums — initial schema
-- Data model per CLAUDE.md. Phase 1, step 2.
--
-- Couples read/write only their own rows (RLS). Admin (Alex) sees the order
-- queue. Share-link read access is deliberately NOT granted here — share pages
-- arrive in Phase 3 and get their own migration.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Enums — the locked vocabularies from CLAUDE.md
-- -----------------------------------------------------------------------------

-- Album status is a state machine: uploading → analyzing → generating → ready
-- → ordered → shipped. Every transition is explicit and logged.
create type public.album_status as enum (
  'uploading',
  'analyzing',
  'generating',
  'ready',
  'ordered',
  'shipped'
);

create type public.album_size as enum ('8x8', '10x10', '12x12');

create type public.photo_orientation as enum ('portrait', 'landscape', 'square');

create type public.order_status as enum ('paid', 'sent_to_lab', 'shipped');

-- -----------------------------------------------------------------------------
-- Admin registry
-- -----------------------------------------------------------------------------

-- Admin is a row, not a JWT claim: revoking access is a delete, and it can't be
-- forged client-side.
create table public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

-- SECURITY DEFINER so RLS policies can consult this table without every user
-- needing read access to it. search_path is pinned to defeat shadowing attacks.
create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

-- -----------------------------------------------------------------------------
-- albums
-- -----------------------------------------------------------------------------

create table public.albums (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null default '',
  status public.album_status not null default 'uploading',
  size public.album_size not null default '10x10',

  -- { hero_photo_id, title_text, subtitle_text, layout_style }
  cover jsonb not null default '{}'::jsonb,

  -- Unguessable, read-only share link (Phase 3). gen_random_uuid() draws from a
  -- CSPRNG, so the hex is 122 bits of entropy — not enumerable.
  share_slug text not null unique
    default replace(gen_random_uuid()::text, '-', ''),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index albums_user_id_idx on public.albums (user_id);

-- -----------------------------------------------------------------------------
-- photos
-- -----------------------------------------------------------------------------

create table public.photos (
  id uuid primary key default gen_random_uuid(),
  album_id uuid not null references public.albums (id) on delete cascade,
  storage_path text not null,
  thumb_path text,
  upload_order integer not null,
  orientation public.photo_orientation,

  -- Claude vision output. Written once, never re-analyzed (cost guardrail).
  analysis jsonb,

  needs_correction boolean not null default false,
  created_at timestamptz not null default now()
);

create index photos_album_id_idx on public.photos (album_id);
create index photos_album_order_idx on public.photos (album_id, upload_order);

-- -----------------------------------------------------------------------------
-- spreads
-- -----------------------------------------------------------------------------

create table public.spreads (
  id uuid primary key default gen_random_uuid(),
  album_id uuid not null references public.albums (id) on delete cascade,
  position integer not null,

  -- The template contract from CLAUDE.md. Constrained here so a bad layout-engine
  -- result fails loudly at write time rather than rendering an empty spread.
  template_code text not null check (
    template_code in (
      'H1', 'H2', 'H3',
      'D1', 'D2', 'D3', 'D4', 'D5',
      'T1', 'T2', 'T3', 'T4', 'T5',
      'M1', 'M2', 'M3', 'M4', 'M5', 'M6', 'M7',
      'DT1', 'DT2', 'DT3'
    )
  ),

  -- { slot_id: photo_id }
  slots jsonb not null default '{}'::jsonb,

  -- Max 3 regenerations per spread (cost guardrail).
  regen_count integer not null default 0 check (regen_count between 0 and 3),

  created_at timestamptz not null default now()
);

create index spreads_album_id_idx on public.spreads (album_id);

-- Deferrable so reordering spreads can shuffle positions inside one transaction
-- without tripping the constraint mid-flight.
alter table public.spreads
  add constraint spreads_album_position_key unique (album_id, position)
  deferrable initially deferred;

-- -----------------------------------------------------------------------------
-- orders
-- -----------------------------------------------------------------------------

create table public.orders (
  id uuid primary key default gen_random_uuid(),

  -- restrict, not cascade: a paid order must survive album deletion. Losing the
  -- record of something someone paid for is not an acceptable failure mode.
  album_id uuid not null references public.albums (id) on delete restrict,

  stripe_session_id text unique,
  amount integer not null check (amount >= 0), -- cents
  size public.album_size not null,
  quantity integer not null default 1 check (quantity > 0),
  shipping jsonb,
  status public.order_status not null default 'paid',
  lab_order_ref text,
  print_pdf_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index orders_album_id_idx on public.orders (album_id);
create index orders_status_idx on public.orders (status);

-- -----------------------------------------------------------------------------
-- updated_at maintenance
-- -----------------------------------------------------------------------------

create function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger albums_touch_updated_at
  before update on public.albums
  for each row execute function public.touch_updated_at();

create trigger orders_touch_updated_at
  before update on public.orders
  for each row execute function public.touch_updated_at();

-- -----------------------------------------------------------------------------
-- Row Level Security
--
-- Default deny. Every table below is unreadable until a policy says otherwise.
-- -----------------------------------------------------------------------------

alter table public.admins enable row level security;
alter table public.albums enable row level security;
alter table public.photos enable row level security;
alter table public.spreads enable row level security;
alter table public.orders enable row level security;

-- admins: readable only by admins. No client-side writes, ever — adding an admin
-- is a deliberate act performed with the service role.
create policy "admins are visible to admins"
  on public.admins for select
  to authenticated
  using (public.is_admin());

-- albums ----------------------------------------------------------------------

create policy "couples read their own albums"
  on public.albums for select
  to authenticated
  using (user_id = auth.uid() or public.is_admin());

create policy "couples create their own albums"
  on public.albums for insert
  to authenticated
  with check (user_id = auth.uid());

-- Both USING and WITH CHECK: USING picks which rows are updatable, WITH CHECK
-- stops the result from being reassigned to another user.
create policy "couples update their own albums"
  on public.albums for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "couples delete their own albums"
  on public.albums for delete
  to authenticated
  using (user_id = auth.uid());

-- photos ----------------------------------------------------------------------

create policy "couples read photos in their albums"
  on public.photos for select
  to authenticated
  using (
    exists (
      select 1 from public.albums a
      where a.id = photos.album_id
        and (a.user_id = auth.uid() or public.is_admin())
    )
  );

create policy "couples add photos to their albums"
  on public.photos for insert
  to authenticated
  with check (
    exists (
      select 1 from public.albums a
      where a.id = photos.album_id and a.user_id = auth.uid()
    )
  );

create policy "couples update photos in their albums"
  on public.photos for update
  to authenticated
  using (
    exists (
      select 1 from public.albums a
      where a.id = photos.album_id and a.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.albums a
      where a.id = photos.album_id and a.user_id = auth.uid()
    )
  );

create policy "couples delete photos in their albums"
  on public.photos for delete
  to authenticated
  using (
    exists (
      select 1 from public.albums a
      where a.id = photos.album_id and a.user_id = auth.uid()
    )
  );

-- spreads ---------------------------------------------------------------------

create policy "couples read spreads in their albums"
  on public.spreads for select
  to authenticated
  using (
    exists (
      select 1 from public.albums a
      where a.id = spreads.album_id
        and (a.user_id = auth.uid() or public.is_admin())
    )
  );

create policy "couples add spreads to their albums"
  on public.spreads for insert
  to authenticated
  with check (
    exists (
      select 1 from public.albums a
      where a.id = spreads.album_id and a.user_id = auth.uid()
    )
  );

create policy "couples update spreads in their albums"
  on public.spreads for update
  to authenticated
  using (
    exists (
      select 1 from public.albums a
      where a.id = spreads.album_id and a.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.albums a
      where a.id = spreads.album_id and a.user_id = auth.uid()
    )
  );

create policy "couples delete spreads in their albums"
  on public.spreads for delete
  to authenticated
  using (
    exists (
      select 1 from public.albums a
      where a.id = spreads.album_id and a.user_id = auth.uid()
    )
  );

-- orders ----------------------------------------------------------------------

-- Read-only to couples. Orders are created by the Stripe webhook and advanced by
-- the admin panel — both service-role paths that bypass RLS. No client may write
-- an order: that would be a client deciding what it paid.
create policy "couples read their own orders"
  on public.orders for select
  to authenticated
  using (
    exists (
      select 1 from public.albums a
      where a.id = orders.album_id
        and (a.user_id = auth.uid() or public.is_admin())
    )
  );

-- -----------------------------------------------------------------------------
-- Storage buckets
--
-- All private. Wedding photos are never served from a public URL; the app hands
-- out short-lived signed URLs instead.
--
-- Path convention: {album_id}/{filename}. The leading folder is the ownership
-- key every storage policy below checks.
-- -----------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values
  ('originals', 'originals', false),
  ('thumbs', 'thumbs', false),
  ('renders', 'renders', false),
  ('print', 'print', false)
on conflict (id) do nothing;

-- Compares album id as text rather than casting the folder to uuid: a junk path
-- should fail the policy quietly, not raise a cast error.
create function public.owns_album_folder(object_name text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.albums a
    where a.user_id = auth.uid()
      and a.id::text = (storage.foldername(object_name))[1]
  );
$$;

create policy "couples manage originals in their albums"
  on storage.objects for all
  to authenticated
  using (
    bucket_id = 'originals' and public.owns_album_folder(name)
  )
  with check (
    bucket_id = 'originals' and public.owns_album_folder(name)
  );

-- Thumbs are generated server-side (service role writes); couples only read.
create policy "couples read thumbs in their albums"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'thumbs' and public.owns_album_folder(name)
  );

create policy "couples read renders in their albums"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'renders' and public.owns_album_folder(name)
  );

-- print: admin only. Print PDFs are written by the background job (service role)
-- and downloaded by Alex from the admin panel. Couples never touch this bucket.
create policy "admins read print files"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'print' and public.is_admin()
  );
