import { cache } from "react";
import { supabaseServer, supabaseServiceRole } from "@/lib/supabaseServer";

export const getAppSettings = cache(async () => {
  const supabase = await supabaseServer();
  const { data, error } = await supabase.from("app_settings").select("*").eq("id", true).maybeSingle();
  if (error) throw new Error(error.message);
  return data;
});

// app_settings' own read policy is admin-only (like app_admins — see
// the RLS lockdown note in lib/auth.js), so an anonymous trip visitor's
// own session can't read this table at all. This is the one exception:
// "who do I email for access" is meant to be public, so it goes
// through the service-role client and returns nothing but the email
// address itself — never the rest of the row.
export const getContactEmail = cache(async () => {
  const supabase = supabaseServiceRole();
  const { data, error } = await supabase
    .from("app_settings")
    .select("contact_email")
    .eq("id", true)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data?.contact_email || null;
});

// Same exception as getContactEmail above, for the same reason: the
// entries/preview scrape route needs this regardless of who's calling
// it (an admin session, or a contributor's bearer token, which never
// gets its own Supabase session at all) — not gated to admin sessions.
// Not cached with React's cache() like the others: this can change
// mid-session whenever an admin refreshes it in Settings, and a scrape
// route is exactly the place that shouldn't be serving a stale value.
export async function getAirbnbSessionCookie() {
  const supabase = supabaseServiceRole();
  const { data, error } = await supabase
    .from("app_settings")
    .select("airbnb_session_cookie")
    .eq("id", true)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data?.airbnb_session_cookie || null;
}
