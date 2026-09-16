import type { SupabaseClient } from "@supabase/supabase-js";
import type { ItineraryStop, ItineraryStopRow, ItineraryEntryOption } from "@/lib/types";

// itinerary_stops CRUD — one trip's day-by-day plan. Each row either
// links to an existing entry (entry_id set — reuses its title/url/
// lat/lng rather than duplicating them) or stands alone (its own
// title/url/lat/lng) for something that isn't a documented entry
// anywhere else (a flight, a ferry, "Depart home"). Same "caller
// passes the client" shape as lib/entries.ts — GET routes pass the
// request-scoped RLS client, write routes pass whichever client
// lib/auth.ts's requireWriteAccess() decided was authorized.

interface LinkedEntry {
  title: string | null;
  url: string | null;
  lat: number | null;
  lng: number | null;
  sections: { slug: string; nav_groups: { slug: string } | null } | null;
}

type StopRowWithEntry = ItineraryStopRow & { entries: LinkedEntry | null };

function toClientStop(row: StopRowWithEntry): ItineraryStop {
  const linked = row.entries;
  const { entries, ...rest } = row;
  return {
    ...rest,
    title: linked?.title ?? rest.title,
    url: linked?.url ?? rest.url,
    lat: linked?.lat ?? rest.lat,
    lng: linked?.lng ?? rest.lng,
    entryNavGroupSlug: linked?.sections?.nav_groups?.slug ?? null,
    entrySectionSlug: linked?.sections?.slug ?? null,
  };
}

export async function getStopsForTrip(supabase: SupabaseClient, tripId: string): Promise<ItineraryStop[]> {
  const { data, error } = await supabase
    .from("itinerary_stops")
    .select("*, entries(title, url, lat, lng, sections(slug, nav_groups(slug)))")
    .eq("trip_id", tripId)
    .order("sort_order", { ascending: true });
  if (error) throw new Error(error.message);
  return (data as StopRowWithEntry[]).map(toClientStop);
}

export interface CreateStopInput {
  entryId?: string | null;
  title?: string | null;
  url?: string | null;
  lat?: number | null;
  lng?: number | null;
  kind?: string;
  status?: string;
  date?: string | null;
  time?: string | null;
  durationMinutes?: number | null;
  travelMode?: string;
  notes?: string | null;
}

// New stops append to the end — same "just add it, drag to reorder
// afterward" flow as everywhere else in this app that has a manual
// order (sections, custom template sections).
export async function createStop(
  supabase: SupabaseClient,
  tripId: string,
  input: CreateStopInput
): Promise<ItineraryStopRow> {
  const { data: last } = await supabase
    .from("itinerary_stops")
    .select("sort_order")
    .eq("trip_id", tripId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextSortOrder = (last?.sort_order ?? -1) + 1;

  const { data, error } = await supabase
    .from("itinerary_stops")
    .insert({
      trip_id: tripId,
      entry_id: input.entryId || null,
      title: input.title || null,
      url: input.url || null,
      lat: input.lat ?? null,
      lng: input.lng ?? null,
      kind: input.kind || "activity",
      status: input.status || "tentative",
      date: input.date || null,
      time: input.time || null,
      duration_minutes: input.durationMinutes ?? null,
      travel_mode: input.travelMode || "driving",
      notes: input.notes || null,
      sort_order: nextSortOrder,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

// Replaces whichever of these fields are present — same "submit its
// full current state for the fields it owns" semantics as the
// sections PATCH route, not a diff.
export interface UpdateStopInput {
  title?: string | null;
  url?: string | null;
  lat?: number | null;
  lng?: number | null;
  kind?: string;
  status?: string;
  date?: string | null;
  time?: string | null;
  durationMinutes?: number | null;
  travelMode?: string;
  notes?: string | null;
  sortOrder?: number;
}

// `tripId` scopes both the update and delete below to the trip the
// route resolved from the URL — without it, a stop id valid for some
// *other* trip would still match a bare `.eq("id", stopId)`, letting
// a request authorized for trip A quietly edit trip B's stop.
export async function updateStop(
  supabase: SupabaseClient,
  tripId: string,
  stopId: string,
  input: UpdateStopInput
): Promise<ItineraryStopRow | null> {
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.title !== undefined) patch.title = input.title;
  if (input.url !== undefined) patch.url = input.url;
  if (input.lat !== undefined) patch.lat = input.lat;
  if (input.lng !== undefined) patch.lng = input.lng;
  if (input.kind !== undefined) patch.kind = input.kind;
  if (input.status !== undefined) patch.status = input.status;
  if (input.date !== undefined) patch.date = input.date;
  if (input.time !== undefined) patch.time = input.time;
  if (input.durationMinutes !== undefined) patch.duration_minutes = input.durationMinutes;
  if (input.travelMode !== undefined) patch.travel_mode = input.travelMode;
  if (input.notes !== undefined) patch.notes = input.notes;
  if (typeof input.sortOrder === "number") patch.sort_order = input.sortOrder;

  const { data, error } = await supabase
    .from("itinerary_stops")
    .update(patch)
    .eq("id", stopId)
    .eq("trip_id", tripId)
    .select()
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function deleteStop(supabase: SupabaseClient, tripId: string, stopId: string): Promise<void> {
  const { error } = await supabase.from("itinerary_stops").delete().eq("id", stopId).eq("trip_id", tripId);
  if (error) throw new Error(error.message);
}

// The itinerary's own "link an existing entry" search — scoped to just
// this trip, unlike lib/entries.ts's cross-trip searchEntriesByTitle
// (linking a stop to some other trip's entry wouldn't make sense).
// Returns every entry in the trip, not search-filtered — the "link an
// existing entry" picker is a type-then-pick pair of dropdowns (Stays:
// Stayed Before -> then which one), not a name search: you often
// remember which *list* something's on before you remember its exact
// name. The client groups these by sectionId to build both dropdowns
// from one fetch.
export async function getAllEntriesForItinerary(supabase: SupabaseClient, tripId: string): Promise<ItineraryEntryOption[]> {
  const { data, error } = await supabase
    .from("entries")
    .select("id, title, url, lat, lng, section_id, sections!inner(label, nav_groups!inner(label))")
    .eq("trip_id", tripId)
    .order("title", { ascending: true });
  if (error) throw new Error(error.message);
  return (
    data as unknown as {
      id: string;
      title: string | null;
      url: string | null;
      lat: number | null;
      lng: number | null;
      section_id: string;
      sections: { label: string; nav_groups: { label: string } };
    }[]
  ).map((row) => {
    const { sections, section_id, ...entry } = row;
    return { ...entry, sectionId: section_id, sectionLabel: sections.label, navGroupLabel: sections.nav_groups.label };
  });
}
