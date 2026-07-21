-- =============================================================================
-- PLATFORM_SPEC.md P0 (additive half): universal accounts.
--
-- Everyone who signs up gets an accounts row (trigger); existing photographer
-- rows and users are backfilled; galleries repoint to accounts via owner_id.
-- NOTHING is dropped here — photographer_accounts, staff, and the proof tables
-- remain until the destructive half is explicitly approved.
-- =============================================================================

create extension if not exists citext;

create table public.accounts (
  user_id uuid primary key,
  -- Public profile @handle (P1); nullable until claimed.
  handle citext unique,
  display_name text,
  avatar_key text,
  account_type text not null default 'personal'
    check (account_type in ('personal', 'pro')),
  -- Config-driven; see src/lib/plans.ts.
  plan text not null default 'free',
  created_at timestamptz not null default now()
);

alter table public.accounts enable row level security;

create policy "users manage their own account"
  on public.accounts for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Backfill: photographers first (they keep pro type + their plan)...
insert into public.accounts (user_id, display_name, account_type, plan, created_at)
select user_id, business_name, 'pro', plan, created_at
from public.photographer_accounts
on conflict (user_id) do nothing;

-- ...then every remaining auth user.
insert into public.accounts (user_id, display_name)
select id, split_part(coalesce(email, 'someone'), '@', 1)
from auth.users
on conflict (user_id) do nothing;

-- Every future signup provisions itself.
create function public.provision_account()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.accounts (user_id, display_name)
  values (new.id, split_part(coalesce(new.email, 'someone'), '@', 1))
  on conflict (user_id) do nothing;
  return new;
end;
$$;

create trigger auth_users_provision_account
  after insert on auth.users
  for each row execute function public.provision_account();

-- Galleries belong to accounts now.
alter table public.galleries
  drop constraint galleries_photographer_id_fkey;
alter table public.galleries
  rename column photographer_id to owner_id;
alter table public.galleries
  add constraint galleries_owner_id_fkey
    foreign key (owner_id) references public.accounts (user_id) on delete cascade;

drop policy "photographers manage their own galleries" on public.galleries;
create policy "owners manage their own galleries"
  on public.galleries for all
  to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop policy "photographers manage their own gallery photos" on public.gallery_photos;
create policy "owners manage their own gallery photos"
  on public.gallery_photos for all
  to authenticated
  using (
    exists (
      select 1 from public.galleries g
      where g.id = gallery_photos.gallery_id and g.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.galleries g
      where g.id = gallery_photos.gallery_id and g.owner_id = auth.uid()
    )
  );

drop policy "photographers read their gallery favorites" on public.gallery_favorites;
create policy "owners read their gallery favorites"
  on public.gallery_favorites for select
  to authenticated
  using (
    exists (
      select 1 from public.galleries g
      where g.id = gallery_favorites.gallery_id and g.owner_id = auth.uid()
    )
  );
