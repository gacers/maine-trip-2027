-- Country label for cross-trip catalog / Future Interest filters
-- (e.g. "United States", "Scotland") — set in Trip Settings.
alter table trips add column if not exists country text;

-- Site-wide wishlist of places to try later — not tied to one trip's
-- Options list. Admin/editors manage; invite-only viewers don't see it.
create table if not exists future_interest_items (
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
  visited boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists future_interest_items_category_idx on future_interest_items (category_slug);
create index if not exists future_interest_items_visited_idx on future_interest_items (visited);
create index if not exists future_interest_items_source_entry_idx on future_interest_items (source_entry_id);

alter table future_interest_items enable row level security;

do $$ begin
  create policy future_interest_items_admin_all on future_interest_items
    for all
    using (exists (select 1 from app_admins where user_id = auth.uid()))
    with check (exists (select 1 from app_admins where user_id = auth.uid()));
exception when duplicate_object then null;
end $$;
