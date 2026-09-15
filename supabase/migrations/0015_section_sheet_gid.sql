-- Each section's own tab within the trip's shared spreadsheet has a
-- Google-assigned numeric sheetId ("gid") — persisting it lets the
-- site's own "Google Sheet" link jump straight to that section's tab
-- (spreadsheetUrl#gid=<sheet_gid>) instead of always landing on
-- whichever tab happened to be open last. Populated by
-- lib/sheetsExport.ts's ensureTab on every export; null until a
-- section's first export.
alter table sections add column if not exists sheet_gid integer;
