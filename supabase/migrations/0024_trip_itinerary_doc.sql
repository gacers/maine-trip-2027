-- Same shape as trips.google_sheet_id/google_sheet_url (0001_init.sql) —
-- one Google Doc per trip for the itinerary export, created lazily on
-- first export and reused after that (see lib/itineraryDocExport.ts).
alter table trips
  add column google_itinerary_doc_id text,
  add column google_itinerary_doc_url text;
