-- Designers need the couple's photos to design from: read access to the
-- originals (to download full-res) and thumbs (for the studio grid).

create policy "staff read originals"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'originals' and public.is_staff());

create policy "staff read thumbs"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'thumbs' and public.is_staff());
