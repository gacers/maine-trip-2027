-- Multi-trip rewrite: trips / nav_groups / sections / field_defs / entries,
-- plus the write-access tables (app_admins for people, api_keys for
-- Claude Desktop / automation). See docs/multi-trip-plan.md (or the
-- session that designed this) for the full rationale.
--
-- Apply via the Supabase Dashboard's SQL Editor, or `supabase db push`
-- once the CLI is linked to the project.

create extension if not exists pgcrypto;

-- ── Trips ────────────────────────────────────────────────────────────
create table trips (
  id               uuid primary key default gen_random_uuid(),
  slug             text not null unique,          -- "maine-2027" -> /maine-2027
  name             text not null,
  subtitle         text,
  start_date       date,
  end_date         date,
  -- Per-trip map reference points + driving-time origin (replaces the
  -- hardcoded Acadia/Stonington/Brooklyn constants every trip used to
  -- share). Shape: { referencePoints: [{lat,lng,label,color}, ...],
  -- originLabel: "Brooklyn, NY" }
  map_config       jsonb not null default '{}'::jsonb,
  google_sheet_id  text,
  google_sheet_url text,
  archived         boolean not null default false,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index trips_order_idx on trips (archived, start_date desc nulls last, created_at desc);

-- ── Nav groups (today's GROUPS in lib/collections.js) ───────────────
create table nav_groups (
  id         uuid primary key default gen_random_uuid(),
  trip_id    uuid not null references trips(id) on delete cascade,
  slug       text not null,
  label      text not null,          -- "Houses" / "Food & Drink" / "Activities"
  sort_order int  not null default 0,
  unique (trip_id, slug)
);

-- ── Sections (today's COLLECTIONS entries, now dynamic per trip) ───
create table sections (
  id               uuid primary key default gen_random_uuid(),
  trip_id          uuid not null references trips(id) on delete cascade,
  nav_group_id     uuid references nav_groups(id) on delete set null,
  slug             text not null,             -- URL segment: /{tripSlug}/{slug}
  label            text not null,
  sub_nav_label    text,
  add_placeholder  text,
  empty_message    text,
  supports_pairing boolean not null default false,  -- groupLabel 2-item pairing UI
  has_map          boolean not null default false,  -- render ListingMap/GroupMap/OverviewMap
  sort_order       int  not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (trip_id, slug)
);
create index sections_trip_id_idx on sections (trip_id);

-- ── Field defs (Section Designer's per-section field list) ─────────
create table field_defs (
  id               uuid primary key default gen_random_uuid(),
  section_id       uuid not null references sections(id) on delete cascade,
  key              text not null,   -- jsonb key when storage='jsonb'; ignored when storage='core'
  label            text not null,
  field_type       text not null check (field_type in
                     ('text','textarea','url','image_url','number','count','price','select','boolean','date')),
  -- 'core' = this field just relabels one of entries' first-class optional
  -- columns; 'jsonb' = it lives in entries.data->>key.
  storage          text not null default 'jsonb' check (storage in ('core','jsonb')),
  core_column      text check (core_column in
                     ('title','url','poster_image','description','lat','lng','notes','concerns')),
  show_on_overview boolean not null default false,   -- included in the Sheets export tab
  required         boolean not null default false,
  options          jsonb,           -- e.g. {"choices":["A","B"]} for field_type='select'
  sort_order       int  not null default 0,
  created_at       timestamptz not null default now(),
  unique (section_id, key)
);
create index field_defs_section_id_idx on field_defs (section_id);

-- ── Entries (today's Sheets rows) ───────────────────────────────────
create table entries (
  -- text, not uuid: preserves legacy nanoid(8) ids from the Sheets
  -- migration so existing "#listing-<id>" anchors keep resolving.
  id             text primary key,
  section_id     uuid not null references sections(id) on delete cascade,
  trip_id        uuid not null references trips(id) on delete cascade, -- kept in sync by trigger below
  rank           integer,
  status         text not null default 'active' check (status in ('active','archived')),
  archive_reason text,
  notes          text,
  concerns       text,
  -- commonly-reused-but-optional universal columns:
  title          text,
  url            text,
  poster_image   text,
  description    text,
  lat            double precision,
  lng            double precision,
  extra_markers  jsonb not null default '[]'::jsonb,
  group_label    text,
  -- section-specific attributes (price, bedrooms, beds, bathrooms today;
  -- anything the Section Designer invents later), keyed by field_defs.key
  data           jsonb not null default '{}'::jsonb,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index entries_section_id_idx on entries (section_id);
create index entries_trip_id_idx    on entries (trip_id);
create index entries_status_idx     on entries (status);
create index entries_data_gin_idx   on entries using gin (data);

-- entries.trip_id is denormalized purely for cheap RLS/queries; this
-- trigger makes it impossible for it to drift from sections.trip_id.
create or replace function entries_sync_trip_id() returns trigger as $$
begin
  select trip_id into new.trip_id from sections where id = new.section_id;
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger entries_sync_trip_id_trg
before insert or update on entries
for each row execute function entries_sync_trip_id();

-- ── Admin allowlist (writes gated on this, not just "any logged-in user") ──
-- Supabase Auth allows public sign-up by default; this table is the real
-- gate so a stray sign-up can't get write access. No RLS policy is
-- defined on it at all, which — with RLS enabled — means anon/authenticated
-- roles get zero access; only the service-role key (server-only) can
-- read/write it.
create table app_admins (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  email      text not null,
  created_at timestamptz not null default now()
);
alter table app_admins enable row level security;

-- ── API keys ─────────────────────────────────────────────────────────
-- So Claude Desktop (and any future AI/automation) can keep writing
-- without a browser session. Tokens are shown once at creation and
-- stored only as a hash — the app's own Next.js API routes check this
-- table server-side (via the privileged service-role client) and never
-- hand the service-role key itself to a caller. No RLS policy defined
-- here either — service-role only, same reasoning as app_admins.
create table api_keys (
  id           uuid primary key default gen_random_uuid(),
  trip_id      uuid references trips(id) on delete cascade,  -- null = valid across all trips
  label        text not null,             -- e.g. "Claude Desktop - Maine 2027"
  key_hash     text not null,             -- sha256 of the actual token
  created_at   timestamptz not null default now(),
  last_used_at timestamptz,
  revoked      boolean not null default false
);
alter table api_keys enable row level security;

-- ── RLS: public read, admin-allowlisted write, on every content table ──
alter table trips      enable row level security;
alter table nav_groups enable row level security;
alter table sections   enable row level security;
alter table field_defs enable row level security;
alter table entries    enable row level security;

create policy trips_read on trips for select using (true);
create policy trips_ins  on trips for insert with check (exists (select 1 from app_admins a where a.user_id = auth.uid()));
create policy trips_upd  on trips for update using (exists (select 1 from app_admins a where a.user_id = auth.uid()));
create policy trips_del  on trips for delete using (exists (select 1 from app_admins a where a.user_id = auth.uid()));

create policy nav_groups_read on nav_groups for select using (true);
create policy nav_groups_ins  on nav_groups for insert with check (exists (select 1 from app_admins a where a.user_id = auth.uid()));
create policy nav_groups_upd  on nav_groups for update using (exists (select 1 from app_admins a where a.user_id = auth.uid()));
create policy nav_groups_del  on nav_groups for delete using (exists (select 1 from app_admins a where a.user_id = auth.uid()));

create policy sections_read on sections for select using (true);
create policy sections_ins  on sections for insert with check (exists (select 1 from app_admins a where a.user_id = auth.uid()));
create policy sections_upd  on sections for update using (exists (select 1 from app_admins a where a.user_id = auth.uid()));
create policy sections_del  on sections for delete using (exists (select 1 from app_admins a where a.user_id = auth.uid()));

create policy field_defs_read on field_defs for select using (true);
create policy field_defs_ins  on field_defs for insert with check (exists (select 1 from app_admins a where a.user_id = auth.uid()));
create policy field_defs_upd  on field_defs for update using (exists (select 1 from app_admins a where a.user_id = auth.uid()));
create policy field_defs_del  on field_defs for delete using (exists (select 1 from app_admins a where a.user_id = auth.uid()));

create policy entries_read on entries for select using (true);
create policy entries_ins  on entries for insert with check (exists (select 1 from app_admins a where a.user_id = auth.uid()));
create policy entries_upd  on entries for update using (exists (select 1 from app_admins a where a.user_id = auth.uid()));
create policy entries_del  on entries for delete using (exists (select 1 from app_admins a where a.user_id = auth.uid()));
