-- Track entries that started life as Future Interests manuals so we can
-- restore them if the trip is deleted before they're marked visited.
alter table entries
  add column if not exists promoted_from_future_interest boolean not null default false;

alter table entries
  add column if not exists future_interest_origin_id text;

create index if not exists entries_promoted_from_fi_idx
  on entries (trip_id)
  where promoted_from_future_interest;
