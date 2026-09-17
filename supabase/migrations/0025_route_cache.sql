-- Backs lib/routeCache.ts — every drive/walk/bike/transit time the
-- itinerary's own RouteConnector computes between two coordinates,
-- reused by every future page view (any trip, any visitor) instead of
-- re-asking the Directions API for the exact same pair. Not trip-
-- scoped: two different trips whose stops happen to share a physical
-- location benefit from the same cached row, and there's nothing
-- trip-specific about "how long is the drive from A to B" anyway.
create table route_cache (
  id                uuid primary key default gen_random_uuid(),
  -- Rounded to ~1m precision (see lib/routeCache.ts's round()) — close
  -- enough that the same place geocoded twice with tiny float drift
  -- still hits the same row, not so coarse that two genuinely
  -- different addresses a block apart collide.
  origin_lat        double precision not null,
  origin_lng        double precision not null,
  dest_lat          double precision not null,
  dest_lng          double precision not null,
  travel_mode       text not null check (travel_mode in ('driving','walking','transit','bicycling')),
  distance_text     text not null,
  duration_text     text not null,
  distance_meters   integer,
  duration_seconds  integer,
  computed_at       timestamptz not null default now(),
  created_at        timestamptz not null default now()
);

-- The de-dupe/freshness-check key — see getOrComputeRoute's own upsert
-- (onConflict on these same 5 columns).
create unique index route_cache_key on route_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_mode);

alter table route_cache enable row level security;

-- No trip_id to scope by (see the table's own comment) — every access
-- already goes through requireReadAccess for *some* trip before this
-- table is ever touched (see the itinerary/route route), so this
-- itself just needs to allow the service-role client that check hands
-- back; nothing here is trip- or user-specific to further restrict.
create policy route_cache_all on route_cache for all using (true) with check (true);
