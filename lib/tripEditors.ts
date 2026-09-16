import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseServer } from "@/lib/supabaseServer";

// Same shape as getAdminUser() in lib/auth.ts — for Server Components/
// layouts that need to know which trips the *current signed-in user*
// (if any) is a permanent editor on. Relies on the
// trip_editors_self_read RLS policy, so this works with a user's own
// session client and needs no service-role access.
export async function getEditorTripIds(): Promise<string[]> {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  const { data } = await supabase.from("trip_editors").select("trip_id").eq("user_id", user.id);
  return (data || []).map((r) => r.trip_id as string);
}

export async function isEditorForTrip(tripId: string): Promise<boolean> {
  const ids = await getEditorTripIds();
  return ids.includes(tripId);
}

// Used by requireWriteAccess (lib/auth.ts), which already has a
// request-scoped client and a resolved user from its own
// supabase.auth.getUser() call — takes both instead of re-deriving them,
// so a single request never creates a second client or re-checks the
// session just to ask this one question.
export async function checkEditorForTrip(supabase: SupabaseClient, userId: string, tripId: string): Promise<boolean> {
  const { data } = await supabase.from("trip_editors").select("trip_id").eq("user_id", userId).eq("trip_id", tripId).maybeSingle();
  return !!data;
}
