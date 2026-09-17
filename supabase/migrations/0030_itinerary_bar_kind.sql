-- Adds "bar" as its own Kind, alongside the original 5 — a bar reads
-- differently enough from a sit-down "meal" to want its own label on
-- the itinerary card and in the Doc export (see KIND_LABEL in
-- StopCard.tsx/lib/itineraryDocExport.ts and KIND_LABELS in
-- StopScheduleFields.tsx).
alter table itinerary_stops drop constraint itinerary_stops_kind_check;
alter table itinerary_stops add constraint itinerary_stops_kind_check
  check (kind in ('lodging','activity','meal','bar','transport','other'));
