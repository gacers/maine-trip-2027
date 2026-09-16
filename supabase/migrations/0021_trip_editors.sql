-- A real, permanent login for someone who arrived via an invite link,
-- as an alternative to the existing per-browser contributor token (see
-- lib/inviteClient.ts) — persists across devices/browsers (unlike a
-- localStorage token, which also doesn't survive a private/incognito
-- window at all) and can cover more than one trip. Deliberately NOT a
-- row in app_admins — that table is global, trip-config-level access;
-- this is a per-trip membership list for the same edit/archive/no-
-- delete tier a contributor already has (see lib/auth.ts's
-- requireWriteAccess, minRole: "editor").
create table trip_editors (
  trip_id        uuid not null references trips(id) on delete cascade,
  user_id        uuid not null references auth.users(id) on delete cascade,
  created_at     timestamptz not null default now(),
  -- Bumped whenever this editor makes a write on this trip — lets a
  -- multi-trip editor who lands on a trip that isn't theirs get sent
  -- back to whichever of their trips they were actually last using,
  -- not just an arbitrary one.
  last_active_at timestamptz not null default now(),
  primary key (trip_id, user_id)
);

alter table trip_editors enable row level security;

-- A user can see their own membership rows (so a signed-in editor's own
-- session client can ask "which trips am I on"). No insert/update/
-- delete policy — service-role only, same lockdown as app_admins/
-- api_keys: an editor is granted access by an admin action, never by
-- writing this table directly themselves.
create policy trip_editors_self_read on trip_editors
  for select using (user_id = auth.uid());
