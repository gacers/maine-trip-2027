-- Adds "car_service" (Uber/taxi/car service) as a selectable travel
-- mode for an itinerary stop, alongside the existing 4 real Google
-- Directions modes. It's presentation-only, not a 5th Directions mode:
-- Google's own API has no "rideshare" mode (a car service drives the
-- same roads a regular car would), so wherever a car_service leg's
-- actual drive time gets computed, the app maps it to "driving" before
-- calling /directions (see RouteConnector.tsx) — this constraint is
-- just what itinerary_stops.travel_mode itself is allowed to store,
-- not what reaches Google.
alter table itinerary_stops drop constraint itinerary_stops_travel_mode_check;
alter table itinerary_stops add constraint itinerary_stops_travel_mode_check
  check (travel_mode in ('driving','walking','transit','bicycling','car_service'));
