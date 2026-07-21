-- Attribution travels with the photo. Needed for CC-licensed demo content
-- (and useful later: second shooters, guest submissions, stock).
alter table public.gallery_photos
  add column credit text;
