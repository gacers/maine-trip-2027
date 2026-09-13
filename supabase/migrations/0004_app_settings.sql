-- Site-wide settings editable from an admin page, not hardcoded env
-- vars — specifically so the Drive folder trip-export Sheets get
-- created in (and the site's own base URL, used to build links back
-- to the live site from those Sheets) can both be changed later
-- without a code change or redeploy.
--
-- Singleton-row trick: a boolean primary key can only ever be `true`
-- (the check forces it), so this table can never hold more than one row.
create table app_settings (
  id boolean primary key default true check (id),
  google_drive_folder_id text,
  site_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table app_settings enable row level security;

create policy app_settings_read on app_settings for select
  using (exists (select 1 from app_admins a where a.user_id = auth.uid()));
create policy app_settings_ins on app_settings for insert
  with check (exists (select 1 from app_admins a where a.user_id = auth.uid()));
create policy app_settings_upd on app_settings for update
  using (exists (select 1 from app_admins a where a.user_id = auth.uid()));

insert into app_settings (id, site_url) values (true, 'https://www.countrygothtravel.com');
