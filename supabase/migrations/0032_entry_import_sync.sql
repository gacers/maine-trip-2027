-- Turns "import entries from another section" from a one-time copy
-- into an ongoing one-way sync (see lib/entrySync.ts). A destination
-- section/entry keeps pointing at its own source row; the source's
-- own shared fields flow into every destination whenever the source
-- changes. Trip-specific fields (notes, concerns, visited/visited_date,
-- status) stay local even once linked.
--
-- on delete set null (not cascade) on both: if a source section/entry
-- is later deleted, its destinations don't vanish with it — they just
-- stop being locked/synced and become regular, independently-editable
-- content again.
alter table sections
  add column import_source_section_id uuid references sections(id) on delete set null;
create index sections_import_source_idx on sections (import_source_section_id);

alter table entries
  add column import_source_entry_id text references entries(id) on delete set null;
create index entries_import_source_idx on entries (import_source_entry_id);
