import { cache } from "react";
import { supabaseServer } from "@/lib/supabaseServer";

export const getAppSettings = cache(async () => {
  const supabase = await supabaseServer();
  const { data, error } = await supabase.from("app_settings").select("*").eq("id", true).maybeSingle();
  if (error) throw new Error(error.message);
  return data;
});
