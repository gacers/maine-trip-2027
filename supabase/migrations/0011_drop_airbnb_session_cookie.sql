-- Reverted: a live session token belongs in an env var like every
-- other credential in this project (Google OAuth tokens, service
-- account keys, Supabase keys), not in the database behind an admin
-- form — no UI representation of it to ever leak, and it never touches
-- a database row or HTTP response. See AIRBNB_SESSION_COOKIE in
-- .env.local instead.
alter table app_settings drop column if exists airbnb_session_cookie;
