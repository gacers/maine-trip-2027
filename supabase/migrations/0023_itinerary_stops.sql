-- Day-by-day trip itinerary: ordered stops, each either linking to an
-- already-documented entry elsewhere in the trip (any section, any nav
-- group -- reusing its title/url/lat/lng) or standing alone for
-- something that isn't really "a place under consideration" anywhere
-- else (a flight, a ferry, "Depart home"). See the itinerary-builder
-- plan for the full design; the shape here was grounded against a real
-- hand-built itinerary, not designed in the abstract.
create table itinerary_stops (
  id                uuid primary key default gen_random_uuid(),
  trip_id           uuid not null references trips(id) on delete cascade,
  -- entries.id is text (legacy nanoid), not uuid -- see 0001_init.sql.
  entry_id          text references entries(id) on delete set null,
  -- Only meaningful when entry_id is null -- a standalone stop.
  title             text,
  url               text,
  lat               double precision,
  lng               double precision,
  -- What this stop actually is -- drives display grouping and Google
  -- Docs export formatting. 'transport' covers flights/ferries/car
  -- rental/drive legs alike, whether or not lat/lng even applies.
  kind              text not null default 'activity'
                       check (kind in ('lodging','activity','meal','transport','other')),
  -- Real trip planning has 3 states, not 2 -- confirmed/booked,
  -- still-deciding (one of several candidate options for the same
  -- slot), and a deliberately-kept discard pile of plans considered
  -- and dropped rather than deleted outright.
  status            text not null default 'tentative'
                       check (status in ('tentative','confirmed','archived')),
  date              date,
  time              time,
  duration_minutes  integer,
  -- Mode of travel for the leg arriving AT this stop (from whichever
  -- stop precedes it in sort_order) -- only meaningful when both this
  -- and the previous stop have lat/lng; irrelevant for a flight/ferry
  -- stop, which describes its own travel in notes/url instead.
  travel_mode       text not null default 'driving'
                       check (travel_mode in ('driving','walking','transit','bicycling')),
  -- Catch-all for everything too specific/varied to warrant its own
  -- column -- address, phone, booking caveats, "must arrive 15 min
  -- early," alternate-route notes. Free multi-line text, same way a
  -- real itinerary just nests bullets under each item.
  notes             text,
  sort_order        integer not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  check (entry_id is not null or title is not null)
);

create index itinerary_stops_trip_order on itinerary_stops (trip_id, sort_order);

alter table itinerary_stops enable row level security;

-- Same shape as entries: public read, admin-only write at the RLS
-- level -- a real editor/contributor write always goes through
-- requireWriteAccess's service-role bypass instead (see lib/auth.ts),
-- authorized by trip_editors/api_keys, not by this policy.
create policy itinerary_stops_read on itinerary_stops for select using (true);
create policy itinerary_stops_ins  on itinerary_stops for insert with check (exists (select 1 from app_admins a where a.user_id = auth.uid()));
create policy itinerary_stops_upd  on itinerary_stops for update using (exists (select 1 from app_admins a where a.user_id = auth.uid()));
create policy itinerary_stops_del  on itinerary_stops for delete using (exists (select 1 from app_admins a where a.user_id = auth.uid()));
