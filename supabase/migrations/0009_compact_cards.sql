-- A section-level layout toggle, same pattern as has_map — houses get
-- one full-width card per row (there's a lot to show: photos, price,
-- bed/bath counts, a map), while food/drink and activities entries are
-- lighter and read better two to a row.
alter table sections add column compact_cards boolean not null default false;
