-- Reorder an album's spreads in ONE statement instead of 2xN sequential
-- updates from the app (a 15-spread reorder was 30 HTTP round trips).
-- The spreads_album_position_key constraint is deferrable initially
-- deferred, so a single UPDATE that permutes positions is legal — the
-- constraint checks at commit.
--
-- SECURITY INVOKER: runs as the calling user, so RLS still decides whether
-- these spreads are theirs to touch. Rows not owned by the caller simply
-- don't update, and the app verifies the full id set before calling.
create or replace function public.reorder_spreads(
  p_album_id uuid,
  p_spread_ids uuid[]
) returns void
language sql
security invoker
as $$
  update public.spreads s
  set position = ord.n
  from unnest(p_spread_ids) with ordinality as ord(id, n)
  where s.id = ord.id
    and s.album_id = p_album_id;
$$;
