"use client";

// Thin client-side wrappers around this trip's own /geocode route (see
// app/api/trips/[tripSlug]/geocode/route.ts + lib/geocodeCache.ts) —
// every caller that used to import geocodeAddress/reverseGeocodeAddress/
// reverseGeocodeTown from lib/loadGoogleMaps.ts (a direct, uncached
// google.maps.Geocoder call) now goes through here instead, so the
// same lookup made twice (the same house's address shown on two page
// loads, the same rental's listing address typed into two different
// trips) hits the server-side cache rather than Google again.

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

async function post<T>(tripSlug: string, body: Record<string, unknown>): Promise<T | null> {
  const res = await fetch(`/api/trips/${tripSlug}/geocode`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
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
export async function fetchForwardGeocode(tripSlug: string, address: string): Promise<ForwardGeocodeResult> {
  const res = await fetch(`/api/trips/${tripSlug}/geocode`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode: "forward", address }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Couldn't find that address");
  return data;
}

export function fetchReverseAddress(tripSlug: string, lat: number, lng: number): Promise<ReverseAddressResult | null> {
  return post<ReverseAddressResult>(tripSlug, { mode: "reverse-address", lat, lng });
}

export function fetchTown(tripSlug: string, lat: number, lng: number): Promise<TownResult | null> {
  return post<TownResult>(tripSlug, { mode: "town", lat, lng });
}
