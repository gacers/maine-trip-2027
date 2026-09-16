-- Every custom nav group/section an admin creates (via "New section",
-- not one of the 3 built-in template buttons) is captured here
-- automatically, so it shows up as a reusable template on every other
-- trip too — no separate "save as template" step. See
-- lib/customSectionTemplates.ts.
create table custom_section_templates (
  id                  uuid primary key default gen_random_uuid(),
  -- Slugified nav_group_label — the de-dupe/merge key: creating another
  -- "Nightlife" section (on this trip or any other) updates this same
  -- row instead of creating a duplicate template.
  template_key        text not null unique,
  nav_group_label     text not null,
  -- Array of { slug, label, subNavLabel, addPlaceholder, emptyMessage,
  -- supportsPairing, hasMap, supportsRatings, cardLayout, fieldDefs }
  -- — everything sections POST needs to recreate this nav group's
  -- section(s) on another trip. A merge (not overwrite) on each capture:
  -- see upsertCustomSectionTemplate.
  sections            jsonb not null,
  created_from_trip_id uuid references trips(id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

alter table custom_section_templates enable row level security;

-- Same read-everywhere/admin-writes shape as nav_groups/sections/field_defs.
create policy custom_section_templates_read on custom_section_templates for select using (true);
create policy custom_section_templates_ins on custom_section_templates for insert with check (exists (select 1 from app_admins a where a.user_id = auth.uid()));
create policy custom_section_templates_upd on custom_section_templates for update using (exists (select 1 from app_admins a where a.user_id = auth.uid()));
create policy custom_section_templates_del on custom_section_templates for delete using (exists (select 1 from app_admins a where a.user_id = auth.uid()));
