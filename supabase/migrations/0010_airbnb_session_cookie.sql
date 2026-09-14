-- Confirmed live: Airbnb serves a disguised 404 to every anonymous
-- request (ours, and three separate paid scraping services tried
-- before this) for a class of listings, but a real logged-in session
-- cookie gets the genuine page every time. Admin-editable rather than
-- a static env var since it's a session token that expires and needs
-- periodic refreshing from the admin's own browser (Settings page) —
-- no code deploy should be required for that.
alter table app_settings add column airbnb_session_cookie text;
