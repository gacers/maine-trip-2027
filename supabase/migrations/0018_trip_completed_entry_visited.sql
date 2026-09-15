-- Trip completion + "did we actually do this" tracking, per-entry.
--
-- trips.completed drives the trips index page's Pending/Past split
-- (past = completed OR its dates have already passed) and gates the
-- "Archive unvisited" nav action. trips.cover_image is the trips-index
-- card's own background photo, set once in Trip Settings.
--
-- entries.visited/visited_date is universal (every section, not just
-- Stay Options) — "Stayed" for a Stay Options entry, "Visited"
-- everywhere else, same underlying fields either way. Sections get
-- sorted by visited_date once a trip is completed.
alter table trips add column if not exists completed boolean not null default false;
alter table trips add column if not exists cover_image text;

alter table entries add column if not exists visited boolean not null default false;
alter table entries add column if not exists visited_date date;
