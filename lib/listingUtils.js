// Small shared helpers for working with a listing's raw sheet fields,
// used by both the per-card map and the shared group map.
export function parseExtraMarkers(raw) {
  if (!raw) return [];
  // Supabase's jsonb column comes back already parsed (a real array);
  // the old Sheets-cell format stored it as a JSON string. Handle both
  // so this needs no changes at either of its two call sites.
  if (Array.isArray(raw)) return raw;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function hasCoords(listing) {
  return (
    listing.lat !== null &&
    listing.lat !== "" &&
    listing.lat !== undefined &&
    listing.lng !== null &&
    listing.lng !== "" &&
    listing.lng !== undefined
  );
}
