-- Every named field (key+label) an admin defines on any section, on
-- any trip, is captured here automatically -- same no-separate-
-- "save as template" idea as custom_section_templates, just one field
-- at a time instead of a whole nav group. See lib/customFieldTemplates.ts.
create table custom_field_templates (
  id                  uuid primary key default gen_random_uuid(),
  -- The de-dupe/merge key: defining another "phone" field anywhere
  -- (this trip or any other, this section or any other) just updates
  -- this same row to the latest label/type/options rather than
  -- creating a duplicate template. Not slugified from the label like
  -- template_key is for sections -- field keys are already
  -- machine-safe (see FieldDefsEditor's own slugify-on-type).
  field_key           text not null unique,
  label               text not null,
  field_type          text not null,
  show_on_overview    boolean not null default false,
  required            boolean not null default false,
  options             jsonb,
  created_from_trip_id uuid references trips(id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

alter table custom_field_templates enable row level security;

-- Same read-everywhere/admin-writes shape as custom_section_templates
-- (writes actually go through the service-role client either way --
-- see requireWriteAccess -- these policies just document the intent).
create policy custom_field_templates_read on custom_field_templates for select using (true);
create policy custom_field_templates_ins on custom_field_templates for insert with check (exists (select 1 from app_admins a where a.user_id = auth.uid()));
create policy custom_field_templates_upd on custom_field_templates for update using (exists (select 1 from app_admins a where a.user_id = auth.uid()));
create policy custom_field_templates_del on custom_field_templates for delete using (exists (select 1 from app_admins a where a.user_id = auth.uid()));
