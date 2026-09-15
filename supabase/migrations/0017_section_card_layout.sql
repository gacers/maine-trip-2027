-- Replaces the old compact_cards boolean (full-width list vs. a 3-
-- across compact grid) with a real 3-way choice, adding a "2 cards at
-- full width" option in between. compact_cards itself is left in place
-- (unused by the app going forward) rather than dropped, so nothing
-- breaks if some other reference to it still exists somewhere.
alter table sections add column if not exists card_layout text not null default 'list'
  check (card_layout in ('list', 'grid-2', 'grid-3'));

update sections set card_layout = case when compact_cards then 'grid-3' else 'list' end;
