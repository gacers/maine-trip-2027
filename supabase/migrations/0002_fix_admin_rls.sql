-- Fix: every other table's write policies (trips_ins, entries_ins, etc.)
-- check `exists (select 1 from app_admins where user_id = auth.uid())`.
-- That subquery is itself subject to app_admins' OWN row-level security
-- — which, with zero policies defined, blocks every role except
-- service-role from seeing ANY row, including a real admin's own.
-- Confirmed live: a genuinely admin, correctly-authenticated user still
-- got 403 "new row violates row-level security policy" on every write,
-- because the EXISTS check could never see their app_admins row at all.
--
-- Fix: let a user read (only) their own app_admins row. Every other
-- operation on this table (insert/update/delete, and reading anyone
-- else's row) is still service-role only — this policy only restores
-- the self-check other tables' policies depend on.
create policy app_admins_self_read on app_admins
  for select using (user_id = auth.uid());
