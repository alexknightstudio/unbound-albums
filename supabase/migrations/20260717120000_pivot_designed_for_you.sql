-- =============================================================================
-- THE PIVOT (2026-07-17): designed-for-you albums.
--
-- Human designers replace the client-facing AI pipeline. Couples upload photos
-- and answer a style brief; staff designers deliver proof rounds (finished
-- spread images from external pro tools); couples leave revision notes and
-- approve. See CLAUDE.md "PIVOT" and DECISIONS.md.
--
-- Legacy AI-era statuses (analyzing / generating / ready) stay in the enum —
-- enums can't shrink and old albums still hold them — but the transition
-- function below gives them no way in and only ready → ordered out.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- New statuses
-- -----------------------------------------------------------------------------

alter type public.album_status add value if not exists 'briefing';
alter type public.album_status add value if not exists 'in_design';
alter type public.album_status add value if not exists 'proof_ready';
alter type public.album_status add value if not exists 'in_revision';
alter type public.album_status add value if not exists 'approved';

-- Compare as text: the new enum values were added in this transaction, and
-- resolving them as enum literals here would trip Postgres's unsafe-use check.
-- Kept in sync with src/lib/albums/status.ts.
create or replace function public.is_legal_album_transition(
  from_status public.album_status,
  to_status public.album_status
)
returns boolean
language sql
immutable
as $$
  select (from_status::text, to_status::text) in (
    ('uploading',   'briefing'),
    ('briefing',    'in_design'),
    ('in_design',   'proof_ready'),
    ('proof_ready', 'in_revision'),   -- the couple sends notes
    ('in_revision', 'proof_ready'),   -- the designer answers with a new round
    ('proof_ready', 'approved'),
    ('approved',    'ordered'),
    ('ready',       'ordered'),       -- legacy AI-era albums can still order
    ('ordered',     'shipped')
  );
$$;

-- -----------------------------------------------------------------------------
-- Staff — designers and admins. Rows created manually in v1.
-- -----------------------------------------------------------------------------

create table public.staff (
  user_id uuid primary key,
  role text not null check (role in ('designer', 'admin')),
  created_at timestamptz not null default now()
);

alter table public.staff enable row level security;

create policy "staff see their own row"
  on public.staff for select
  to authenticated
  using (user_id = auth.uid());

-- SECURITY DEFINER so it can be used inside other tables' policies without
-- recursive RLS evaluation on staff itself.
create function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (select 1 from public.staff where user_id = auth.uid());
$$;

-- -----------------------------------------------------------------------------
-- The brief and the assignment
-- -----------------------------------------------------------------------------

alter table public.albums
  add column brief jsonb,
  add column designer_id uuid;

create policy "staff read all albums"
  on public.albums for select
  to authenticated
  using (public.is_staff());

create policy "staff update albums"
  on public.albums for update
  to authenticated
  using (public.is_staff())
  with check (public.is_staff());

create policy "staff read all photos"
  on public.photos for select
  to authenticated
  using (public.is_staff());

-- -----------------------------------------------------------------------------
-- Proof rounds — what the designer delivers; pages are finished spread images.
-- -----------------------------------------------------------------------------

create table public.proofs (
  id uuid primary key default gen_random_uuid(),
  album_id uuid not null references public.albums (id) on delete cascade,
  round int not null check (round >= 1),
  -- The designer's note to the couple with this round.
  note text,
  created_by uuid,
  created_at timestamptz not null default now(),
  unique (album_id, round)
);

create table public.proof_pages (
  id uuid primary key default gen_random_uuid(),
  proof_id uuid not null references public.proofs (id) on delete cascade,
  position int not null check (position >= 1),
  storage_path text not null,
  unique (proof_id, position)
);

-- The couple's notes on a proof round. position null = about the whole album.
create table public.revision_notes (
  id uuid primary key default gen_random_uuid(),
  proof_id uuid not null references public.proofs (id) on delete cascade,
  position int check (position >= 1),
  note text not null check (char_length(note) between 1 and 2000),
  author_id uuid,
  created_at timestamptz not null default now()
);

alter table public.proofs enable row level security;
alter table public.proof_pages enable row level security;
alter table public.revision_notes enable row level security;

create policy "couples and staff read proofs"
  on public.proofs for select
  to authenticated
  using (
    public.is_staff() or exists (
      select 1 from public.albums a
      where a.id = proofs.album_id and a.user_id = auth.uid()
    )
  );

create policy "staff create proofs"
  on public.proofs for insert
  to authenticated
  with check (public.is_staff());

create policy "couples and staff read proof pages"
  on public.proof_pages for select
  to authenticated
  using (
    public.is_staff() or exists (
      select 1
      from public.proofs p
      join public.albums a on a.id = p.album_id
      where p.id = proof_pages.proof_id and a.user_id = auth.uid()
    )
  );

create policy "staff create proof pages"
  on public.proof_pages for insert
  to authenticated
  with check (public.is_staff());

create policy "couples and staff read revision notes"
  on public.revision_notes for select
  to authenticated
  using (
    public.is_staff() or exists (
      select 1
      from public.proofs p
      join public.albums a on a.id = p.album_id
      where p.id = revision_notes.proof_id and a.user_id = auth.uid()
    )
  );

create policy "couples write notes on their own proofs"
  on public.revision_notes for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.proofs p
      join public.albums a on a.id = p.album_id
      where p.id = revision_notes.proof_id and a.user_id = auth.uid()
    )
  );

-- -----------------------------------------------------------------------------
-- Proof images bucket. Path scheme: {album_id}/r{round}/{position}.jpg
-- -----------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('proofs', 'proofs', false)
on conflict (id) do nothing;

create policy "staff upload proof images"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'proofs' and public.is_staff());

create policy "couples and staff read proof images"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'proofs' and (
      public.is_staff() or exists (
        select 1 from public.albums a
        where a.id::text = (storage.foldername(name))[1]
          and a.user_id = auth.uid()
      )
    )
  );
