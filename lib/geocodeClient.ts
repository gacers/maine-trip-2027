"use client";

// Thin client-side wrappers around this trip's own /geocode route (see
// app/api/trips/[tripSlug]/geocode/route.ts + lib/geocodeCache.ts) —
// every caller that used to import geocodeAddress/reverseGeocodeAddress/
// reverseGeocodeTown from lib/loadGoogleMaps.ts (a direct, uncached
// google.maps.Geocoder call) now goes through here instead, so the
// same lookup made twice (the same house's address shown on two page
// loads, the same rental's listing address typed into two different
// trips) hits the server-side cache rather than Google again.
//
// That route requires real access (requireReadAccess — an admin/editor
// session cookie, or a contributor's invite-link bearer token), same as
// any other real content read. An admin/editor's session cookie rides
// along on same-origin fetches automatically; a contributor has no
// session at all, only the token captured into localStorage (see
// lib/inviteClient.ts) — every function here needs it passed in
// explicitly to actually authenticate as them, or their request just
// 401s.

export interface ForwardGeocodeResult {
  lat: number;
  lng: number;
  formattedAddress: string;
}

export interface ReverseAddressResult {
  formattedAddress: string;
}

export interface TownResult {
  name: string;
  searchQuery: string;
  lat: number;
  lng: number;
}

function authHeaders(authToken?: string | null): Record<string, string> {
  return authToken ? { Authorization: `Bearer ${authToken}` } : {};
}

async function post<T>(tripSlug: string, body: Record<string, unknown>, authToken?: string | null): Promise<T | null> {
  const res = await fetch(`/api/trips/${tripSlug}/geocode`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders(authToken) },
    body: JSON.stringify(body),
  });
  if (!res.ok) return null;
  return res.json();
}

// Throws (matching the old geocodeAddress's own contract — callers
// show err.message directly) rather than returning null, since a typed
// address that can't be found is a real, user-facing failure to
// surface, not a silent fallback the way the two read-only lookups
// below are.
export async function fetchForwardGeocode(tripSlug: string, address: string, authToken?: string | null): Promise<ForwardGeocodeResult> {
  const res = await fetch(`/api/trips/${tripSlug}/geocode`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders(authToken) },
    body: JSON.stringify({ mode: "forward", address }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Couldn't find that address");
  return data;
}

export function fetchReverseAddress(
  tripSlug: string,
  lat: number,
  lng: number,
  authToken?: string | null
): Promise<ReverseAddressResult | null> {
  return post<ReverseAddressResult>(tripSlug, { mode: "reverse-address", lat, lng }, authToken);
}

export function fetchTown(tripSlug: string, lat: number, lng: number, authToken?: string | null): Promise<TownResult | null> {
  return post<TownResult>(tripSlug, { mode: "town", lat, lng }, authToken);
}
