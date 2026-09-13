// Supabase queries for trips / nav / sections / field defs — replaces
// the hardcoded COLLECTIONS/GROUPS objects from lib/collections.js.
// Every trip's structure now lives in the database instead of code, so
// adding a trip or a section never requires a deploy.
import { cache } from "react";
import { supabaseServer } from "@/lib/supabaseServer";

export async function getAllTrips() {
  const supabase = await supabaseServer();
  const { data, error } = await supabase
    .from("trips")
    .select("*")
    .eq("archived", false)
    .order("start_date", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data;
}

// Cached per-request: both a trip's layout and its page (and, for the
// index redirect, its own page too) look this up for the same slug in
// the same request — React's cache() dedupes that into one query.
export const getTripBySlug = cache(async (slug) => {
  const supabase = await supabaseServer();
  const { data, error } = await supabase.from("trips").select("*").eq("slug", slug).maybeSingle();
  if (error) throw new Error(error.message);
  return data;
});

// Nav groups, each with its member sections attached and both levels
// sorted by sort_order (PostgREST doesn't apply an order() on the outer
// query to an embedded relation, so the inner sort happens here).
export async function getTripNav(tripId) {
  const supabase = await supabaseServer();
  const { data, error } = await supabase
    .from("nav_groups")
    .select("*, sections(*)")
    .eq("trip_id", tripId)
    .order("sort_order");
  if (error) throw new Error(error.message);
  return data.map((group) => ({
    ...group,
    sections: (group.sections || []).sort((a, b) => a.sort_order - b.sort_order),
  }));
}

export async function getSectionBySlug(tripId, sectionSlug) {
  const supabase = await supabaseServer();
  const { data, error } = await supabase
    .from("sections")
    .select("*, field_defs(*)")
    .eq("trip_id", tripId)
    .eq("slug", sectionSlug)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (data) data.field_defs = (data.field_defs || []).sort((a, b) => a.sort_order - b.sort_order);
  return data;
}
