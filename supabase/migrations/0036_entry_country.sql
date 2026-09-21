-- Place-level country, stamped from the trip at entry creation (and
-- backfilled for existing rows from trips.country). Hidden from the UI;
-- used by Categories / Future Interest filters.
alter table entries add column if not exists country text;

-- One-time backfill: every entry inherits its trip's country when the
-- trip has one and the entry doesn't yet.
update entries e
set country = t.country
from trips t
where e.trip_id = t.id
  and t.country is not null
  and t.country <> ''
  and (e.country is null or e.country = '');
