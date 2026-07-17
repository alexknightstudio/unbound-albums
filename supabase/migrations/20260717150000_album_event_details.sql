-- Onboarding rework: the start form asks who and where, not what size.
-- Names live in title (as before); the day and the place get real columns —
-- they're album identity, and the designer wants them in the brief panel.
-- Size selection moves to the customizations step (the brief).

alter table public.albums
  add column event_date date,
  add column venue text;
