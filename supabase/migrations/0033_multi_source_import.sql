-- A destination section can now sync from more than one source at once
-- (e.g. Maine 2027's own "Past Distilleries" pulling in 4 earlier
-- trips' own Distilleries lists side by side, instead of just one) —
-- sections.import_source_section_id could only ever hold a single
-- value, so picking a 2nd source meant replacing the 1st outright,
-- wiping its already-synced entries out from under it. This join
-- table replaces that single column with a real one-destination-to-
-- many-sources relationship. entries.import_source_entry_id is
-- untouched — each entry only ever has ONE specific source entry,
-- regardless of how many total sources feed its own section.
create table section_import_sources (
  id uuid primary key default gen_random_uuid(),
  destination_section_id uuid not null references sections(id) on delete cascade,
  source_section_id uuid not null references sections(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (destination_section_id, source_section_id)
);
create index section_import_sources_dest_idx on section_import_sources (destination_section_id);
create index section_import_sources_source_idx on section_import_sources (source_section_id);

alter table section_import_sources enable row level security;
-- Same shape as sections/field_defs/entries (0001_init.sql) — public
-- read, admin-only write. Every actual write in the app runs through
-- the entries/import route's own admin-gated check anyway; this is
-- the DB-level backstop.
create policy section_import_sources_read on section_import_sources for select using (true);
create policy section_import_sources_ins on section_import_sources for insert with check (exists (select 1 from app_admins a where a.user_id = auth.uid()));
create policy section_import_sources_del on section_import_sources for delete using (exists (select 1 from app_admins a where a.user_id = auth.uid()));

insert into section_import_sources (destination_section_id, source_section_id)
select id, import_source_section_id from sections where import_source_section_id is not null;

alter table sections drop column import_source_section_id;
