-- Distinguishes a full "owner" API key (Claude Desktop, etc. — can add,
-- and trip_id may be null meaning valid across every trip, so the
-- owner only ever needs to generate one, ever) from a lesser
-- "contributor" key (an invite link handed to a friend — add-only,
-- always scoped to one specific trip, never global).
alter table api_keys add column role text not null default 'owner' check (role in ('owner', 'contributor'));
