// Supabase queries for trips / nav / sections / field defs — replaces
// the hardcoded COLLECTIONS/GROUPS objects from lib/collections.js.
// Every trip's structure now lives in the database instead of code, so
// adding a trip or a section never requires a deploy.
import { cache } from "react";
import { supabaseServer } from "@/lib/supabaseServer";
import type { Trip, PublicTrip, NavGroup, Section } from "@/lib/types";

// A trip row carries secrets/gated fields that must never reach a
// visitor who hasn't already proven access:
//  - sheet_invite_token/sheet_invite_key_id: a real, live secret —
//    whoever has it gets full add/view-Sheet access, same as an
//    admin-generated invite link.
//  - google_sheet_url/google_sheet_id: gated the same as the Add form
//    (only for an admin session or a valid owner/contributor token) —
//    SectionPage fetches it separately, with real auth, via
//    /api/trips/[tripSlug]/sheet-url once it already knows it has
//    access, rather than getting it for free in its own props.
// Needed as-is by the admin-only Invite/API-keys page and the
// server-side Sheets export — every OTHER caller (the public trips
// list, and every trip/section page that hands its `trip` prop to a
// Client Component) must strip these before the data leaves the
// server. Found live leaking through both the public /api/trips
// response and every trip page's own RSC payload, readable by any
// visitor regardless of access.
export function sanitizeTripForClient(trip: Trip): PublicTrip;
export function sanitizeTripForClient(trip: null | undefined): null | undefined;
export function sanitizeTripForClient(trip: Trip | null | undefined): PublicTrip | null | undefined {
  if (!trip) return trip;
  const { sheet_invite_token, sheet_invite_key_id, google_sheet_url, google_sheet_id, ...safe } = trip;
  return safe;
}

export async function getAllTrips(): Promise<Trip[]> {
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
export const getTripBySlug = cache(async (slug: string): Promise<Trip | null> => {
  const supabase = await supabaseServer();
  const { data, error } = await supabase.from("trips").select("*").eq("slug", slug).maybeSingle();
  if (error) throw new Error(error.message);
  return data;
});

// Nav groups, each with its member sections attached and both levels
// sorted by sort_order (PostgREST doesn't apply an order() on the outer
// query to an embedded relation, so the inner sort happens here).
export async function getTripNav(tripId: string): Promise<NavGroup[]> {
  const supabase = await supabaseServer();
  const { data, error } = await supabase
    .from("nav_groups")
    .select("*, sections(*)")
    .eq("trip_id", tripId)
    .order("sort_order");
  if (error) throw new Error(error.message);
  return data.map((group: NavGroup) => ({
    ...group,
    sections: (group.sections || []).sort((a, b) => a.sort_order - b.sort_order),
  }));
}

// Every section of a trip, flat (not nav-grouped) — used to re-export
// every tab of a trip's Google Sheet at once (e.g. after rotating its
// embedded invite token), where nav grouping/enabled-filtering don't
// matter.
export async function getAllSectionsForTrip(tripId: string): Promise<Section[]> {
  const supabase = await supabaseServer();
  const { data, error } = await supabase.from("sections").select("*, field_defs(*)").eq("trip_id", tripId);
  if (error) throw new Error(error.message);
  return data.map((s: Section) => ({
    ...s,
    field_defs: (s.field_defs || []).sort((a, b) => a.sort_order - b.sort_order),
  }));
}

export async function getSectionBySlug(tripId: string, sectionSlug: string): Promise<Section | null> {
  const supabase = await supabaseServer();
  const { data, error } = await supabase
    .from("sections")
    .select("*, field_defs(*)")
    .eq("trip_id", tripId)
    .eq("slug", sectionSlug)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (data) data.field_defs = (data.field_defs || []).sort((a: { sort_order: number }, b: { sort_order: number }) => a.sort_order - b.sort_order);
  return data;
}
