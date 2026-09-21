-- Per-section opt-in for Concerns on entry cards — same pattern as
-- supports_ratings. Stay Options (pairing) keep it on; everything else
-- starts off and can be turned on in Manage.
alter table sections add column if not exists supports_concerns boolean not null default false;

update sections set supports_concerns = true where supports_pairing = true;
