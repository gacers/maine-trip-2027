-- Lets a trip disable a section (hide it from the public nav) without
-- deleting it or its data — used by the new template picker (Houses/
-- Food & Drink/Activities starter sections you may not want on every
-- trip) and by any manually-created section you want to pause on.
alter table sections add column enabled boolean not null default true;
