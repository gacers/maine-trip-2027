-- A backup date range alongside a trip's primary start_date/end_date —
-- lets Stay Options' Airbnb/VRBO links check availability for a
-- fallback week too when the primary one might not pan out (see
-- lib/listingAvailability.ts). Nullable, independent of the primary
-- pair; either or both may be unset.
alter table trips add column alt_start_date date;
alter table trips add column alt_end_date date;
