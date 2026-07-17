-- Editor polish (Phase 4.5, Alex: "meat and potatoes ... must be perfect").

-- Per-slot reframing: { slot_id: { "x": 0-100, "y": 0-100 } } as CSS
-- object-position percentages. Absent slot = centered (50/50). Lives on the
-- spread, not the photo — the same photo can be framed differently on a
-- regenerated spread.
alter table public.spreads
  add column slot_crops jsonb not null default '{}'::jsonb;

-- Mirrored template geometry (left <-> right). The photos themselves are
-- never mirrored — only the slot rects.
alter table public.spreads
  add column flipped boolean not null default false;
