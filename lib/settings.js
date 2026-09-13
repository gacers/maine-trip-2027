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
