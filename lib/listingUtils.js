// Small shared helpers for working with a listing's raw sheet fields,
// used by both the per-card map and the shared group map.
export function parseExtraMarkers(raw) {
  if (!raw) return [];
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
