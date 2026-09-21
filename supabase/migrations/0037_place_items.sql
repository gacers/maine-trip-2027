-- Site-level Places — known spots (parents' house, local regulars, etc.).
-- Same column shape as future_interest_items; always visited by default.
-- No Options auto-merge — manual rows only.
create table if not exists place_items (
  id text primary key,
  category_slug text not null,
  title text,
  url text,
  poster_image text,
  description text,
  lat double precision,
  lng double precision,
  data jsonb not null default '{}'::jsonb,
  country text,
  source_entry_id text references entries(id) on delete set null,
  visited boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists place_items_category_idx on place_items (category_slug);
create index if not exists place_items_visited_idx on place_items (visited);
create index if not exists place_items_source_entry_idx on place_items (source_entry_id);

alter table place_items enable row level security;

do $$ begin
  create policy place_items_admin_all on place_items
    for all
    using (exists (select 1 from app_admins where user_id = auth.uid()))
    with check (exists (select 1 from app_admins where user_id = auth.uid()));
exception when duplicate_object then null;
end $$;

-- Per-surface settings (e.g. which category tabs Places shows).
create table if not exists site_surface_settings (
  surface text primary key,
  settings jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table site_surface_settings enable row level security;

do $$ begin
  create policy site_surface_settings_admin_all on site_surface_settings
    for all
    using (exists (select 1 from app_admins where user_id = auth.uid()))
    with check (exists (select 1 from app_admins where user_id = auth.uid()));
exception when duplicate_object then null;
end $$;
