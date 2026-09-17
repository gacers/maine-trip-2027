-- One Drive subfolder per trip, created lazily the first time
-- lib/drive.ts's getOrCreateTripFolder needs one (either export --
-- Sheet or itinerary Doc -- creating a file for a trip that doesn't
-- have one yet), living inside the app-wide shared folder
-- (app_settings.google_drive_folder_id). Groups a trip's Sheet and
-- itinerary Doc together instead of every trip's files sitting flat
-- as siblings in one shared folder.
alter table trips
  add column google_drive_folder_id text;
