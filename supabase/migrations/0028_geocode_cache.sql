-- Backs lib/geocodeCache.ts — every reverse-geocoded address, closest-
-- town lookup, and forward-geocoded address this app computes, reused
-- by every future request for the same input instead of re-asking
-- Google. One flexible table rather than three narrow ones: the 3
-- lookup kinds (reverse address, reverse "which town", forward address
-- -> coords) don't share a natural column shape (two are keyed by
-- coordinates, one by free-text address), so `cache_key` just carries
-- a "<kind>:<input>" prefix instead (see lib/geocodeCache.ts's own key
-- builders) and `result` holds whatever shape that kind actually
-- returns. Not trip-scoped, same reasoning as route_cache: "what's the
-- address at this lat/lng" isn't a trip-specific fact.
create table geocode_cache (
  id            uuid primary key default gen_random_uuid(),
  cache_key     text not null unique,
  result        jsonb not null,
  computed_at   timestamptz not null default now(),
  created_at    timestamptz not null default now()
);

alter table geocode_cache enable row level security;

-- Same reasoning as route_cache's own policy — every access already
-- goes through requireReadAccess for *some* trip before this table is
-- ever touched (see the geocode/directions routes), so this itself
-- just needs to allow the service-role client that check hands back.
create policy geocode_cache_all on geocode_cache for all using (true) with check (true);
