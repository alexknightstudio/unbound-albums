-- =============================================================================
-- Album status machine — enforcement and audit log
--
-- CLAUDE.md: "Status is a state machine. Every transition is explicit and logged."
-- Enforced in the database so no code path — app, script, or console — can put an
-- album into a state it can't legally reach.
--
-- Phase 1, step 4.
-- =============================================================================

create table public.album_status_events (
  id uuid primary key default gen_random_uuid(),
  album_id uuid not null references public.albums (id) on delete cascade,

  -- null on creation: an album's first status has no predecessor.
  from_status public.album_status,
  to_status public.album_status not null,

  -- Who caused it. Null means a server-side job (analysis, generation, webhook)
  -- rather than a person. Not a foreign key to auth.users: deleting an account
  -- must not erase the history of what happened.
  actor_id uuid,

  created_at timestamptz not null default now()
);

create index album_status_events_album_idx
  on public.album_status_events (album_id, created_at);

-- -----------------------------------------------------------------------------
-- The legal moves
-- -----------------------------------------------------------------------------

-- uploading → analyzing → generating → ready → ordered → shipped, plus the one
-- backward edge: ready → generating, which is the full-album regenerate.
-- Kept in sync with src/lib/albums/status.ts, which mirrors it for the UI.
create function public.is_legal_album_transition(
  from_status public.album_status,
  to_status public.album_status
)
returns boolean
language sql
immutable
as $$
  select (from_status, to_status) in (
    ('uploading',  'analyzing'),
    ('analyzing',  'generating'),
    ('generating', 'ready'),
    ('ready',      'generating'),  -- full-album regenerate
    ('ready',      'ordered'),
    ('ordered',    'shipped')
  );
$$;

create function public.enforce_album_status_transition()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- Only fires on an actual status change. Renaming an album is not a transition.
  if new.status is not distinct from old.status then
    return new;
  end if;

  if not public.is_legal_album_transition(old.status, new.status) then
    raise exception
      'Illegal album status transition: % -> %', old.status, new.status
      using errcode = 'check_violation';
  end if;

  insert into public.album_status_events (album_id, from_status, to_status, actor_id)
  values (new.id, old.status, new.status, auth.uid());

  return new;
end;
$$;

create trigger albums_enforce_status_transition
  before update of status on public.albums
  for each row execute function public.enforce_album_status_transition();

-- Log the opening state too, so an album's history is complete from row one.
create function public.log_album_status_creation()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.album_status_events (album_id, from_status, to_status, actor_id)
  values (new.id, null, new.status, auth.uid());
  return new;
end;
$$;

create trigger albums_log_status_creation
  after insert on public.albums
  for each row execute function public.log_album_status_creation();

-- -----------------------------------------------------------------------------
-- RLS
--
-- Read-only to couples, and only for their own albums. Nothing writes here but
-- the triggers above (SECURITY DEFINER, so they bypass these policies). An audit
-- log a client can write to is not an audit log.
-- -----------------------------------------------------------------------------

alter table public.album_status_events enable row level security;

create policy "couples read their own album history"
  on public.album_status_events for select
  to authenticated
  using (
    exists (
      select 1 from public.albums a
      where a.id = album_status_events.album_id
        and (a.user_id = auth.uid() or public.is_admin())
    )
  );
