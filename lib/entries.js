// Entries CRUD — replaces the appendItem/getAllItems/updateItemByRow/
// deleteItemByRow half of lib/sheets.js. Every function takes a Supabase
// client as its first argument rather than constructing one itself: GET
// routes pass the request-scoped RLS client (public reads are allowed),
// write routes pass whichever client lib/auth.js's requireWriteAccess()
// decided was authorized (the interactive user's own session, or the
// service-role client after an API-key bearer token was verified).

export async function getAllEntries(supabase, sectionId) {
  const { data, error } = await supabase
    .from("entries")
    .select("*")
    .eq("section_id", sectionId)
    .order("rank", { ascending: true, nullsFirst: false });
  if (error) throw new Error(error.message);
  return data;
}

export async function findEntryByUrl(supabase, sectionId, url) {
  const { data, error } = await supabase
    .from("entries")
    .select("*")
    .eq("section_id", sectionId)
    .eq("url", url)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function createEntry(supabase, entry) {
  const { data, error } = await supabase.from("entries").insert(entry).select().single();
  if (error) throw new Error(error.message);
  return data;
}

export async function updateEntry(supabase, id, patch) {
  const { data, error } = await supabase.from("entries").update(patch).eq("id", id).select().single();
  if (error) throw new Error(error.message);
  return data;
}

export async function deleteEntry(supabase, id) {
  const { error } = await supabase.from("entries").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

// Flattens a raw Supabase row into the shape the UI (and the generic,
// collection-shape-agnostic lib/groupUnits.js and lib/listingUtils.js)
// expect: camelCase core fields, and every section-specific `data` key
// (price, bedrooms, whatever a section defines) spread to the top level
// — matching how a plain listing object used to look pre-Supabase.
export function toClientEntry(row) {
  if (!row) return row;
  const { poster_image, archive_reason, group_label, created_at, updated_at, section_id, trip_id, extra_markers, data, ...rest } = row;
  return {
    ...rest,
    posterImage: poster_image,
    archiveReason: archive_reason || "",
    groupLabel: group_label || "",
    createdAt: created_at,
    updatedAt: updated_at,
    sectionId: section_id,
    tripId: trip_id,
    extraMarkers: extra_markers || [],
    ...(data || {}),
  };
}
