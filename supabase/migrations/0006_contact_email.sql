-- Who a visitor without an invite link should email to ask for access.
-- Admin-editable (like site_url and google_drive_folder_id) rather than
-- hardcoded, since there's more than one admin. Deliberately public —
-- see lib/settings.js's getContactEmail(), which reads only this one
-- column via the service-role client so an anonymous visitor's own
-- session (blocked by app_settings' admin-only read policy) never
-- needs to see the rest of this table.
alter table app_settings add column contact_email text;

update app_settings set contact_email = 'gary.acers@gmail.com' where id = true;
