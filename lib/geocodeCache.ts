import type { SupabaseClient } from "@supabase/supabase-js";

// Addresses and town boundaries essentially never change on any
// timescale this app cares about — same reasoning as route_cache's own
// long TTL for driving/walking/biking, just longer still since there's
// no transit-schedule-style exception here.
const TTL_DAYS = 365;

// ~1m precision — enough that the same physical point geocoded twice
// with tiny float drift still hits the same cache row.
function round(n: number): number {
  return Math.round(n * 1e6) / 1e6;
}

async function getCached<T>(supabase: SupabaseClient, key: string): Promise<T | null> {
  const { data } = await supabase.from("geocode_cache").select("result, computed_at").eq("cache_key", key).maybeSingle();
  if (!data) return null;
  const ttlMs = TTL_DAYS * 24 * 60 * 60 * 1000;
  if (Date.now() - new Date(data.computed_at).getTime() > ttlMs) return null;
  return data.result as T;
}

async function setCached(supabase: SupabaseClient, key: string, result: unknown): Promise<void> {
  // Best-effort — a caching write failing shouldn't turn a perfectly
  // good geocoding result into an error response.
  const { error } = await supabase
    .from("geocode_cache")
    .upsert({ cache_key: key, result, computed_at: new Date().toISOString() }, { onConflict: "cache_key" });
  if (error) console.error("geocode_cache upsert failed:", error);
}

interface GoogleGeocodeResponse {
  status: string;
  results: {
    formatted_address: string;
    geometry: { location: { lat: number; lng: number } };
    types: string[];
    address_components: { long_name: string; short_name: string; types: string[] }[];
  }[];
}

// Server-side REST call — see GOOGLE_MAPS_SERVER_API_KEY's own comment
// in .env.example (shared with lib/routeCache.ts's own Directions call).
async function callGoogleGeocode(params: Record<string, string>): Promise<GoogleGeocodeResponse> {
  const apiKey = process.env.GOOGLE_MAPS_SERVER_API_KEY;
  if (!apiKey) throw new Error("GOOGLE_MAPS_SERVER_API_KEY is not set");
  const qs = new URLSearchParams({ ...params, key: apiKey });
  const res = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?${qs}`);
  return res.json();
}

export interface ReverseAddressResult {
  formattedAddress: string;
}

export interface CountryResult {
  /** Region label: US state, UK constituent country, or country name. */
  country: string;
}

// Prefer a finer region when Google only gives a federal/umbrella country:
// US → state (Maine, New York, …); UK → England / Scotland / Wales /
// Northern Ireland. Everywhere else uses the country long_name.
function regionFromGeocodeResults(results: GoogleGeocodeResponse["results"]): string | null {
  for (const r of results) {
    const comps = r.address_components || [];
    const countryComp = comps.find((c) => c.types.includes("country"));
    if (!countryComp) continue;
    const isUs = countryComp.short_name === "US" || countryComp.long_name === "United States";
    const isUk =
      countryComp.short_name === "GB" ||
      countryComp.long_name === "United Kingdom" ||
      countryComp.long_name === "United Kingdom of Great Britain and Northern Ireland";
    if (isUs || isUk) {
      const regionComp = comps.find((c) => c.types.includes("administrative_area_level_1"));
      if (regionComp?.long_name) return regionComp.long_name;
    }
    return countryComp.long_name;
  }
  return null;
}

// For the address line under a listing's title (EntryCard) — was
// google.maps.Geocoder client-side, called fresh on every card render,
// for every card, on every page view. Now cached indefinitely per
// coordinate.
export async function getOrComputeReverseAddress(
  supabase: SupabaseClient,
  lat: number,
  lng: number
): Promise<ReverseAddressResult | null> {
  const key = `reverse-address:${round(lat)},${round(lng)}`;
  const cached = await getCached<ReverseAddressResult>(supabase, key);
  if (cached) return cached;

  const data = await callGoogleGeocode({ latlng: `${lat},${lng}` });
  if (data.status !== "OK" || !data.results?.[0]) return null;

  const result: ReverseAddressResult = { formattedAddress: data.results[0].formatted_address };
  await setCached(supabase, key, result);

  // Same Google response also carries region — stash it under its own
  // key so entry-country lookups don't re-hit Google for this point.
  const country = regionFromGeocodeResults(data.results);
  if (country) await setCached(supabase, `place-region:${round(lat)},${round(lng)}`, { country } satisfies CountryResult);

  return result;
}

// Region of a lat/lng for entry.country — US state / UK nation when
// applicable, otherwise country name. Same Google call as reverse-address
// when that path runs first; own cache key otherwise.
export async function getOrComputeCountry(
  supabase: SupabaseClient,
  lat: number,
  lng: number
): Promise<CountryResult | null> {
  const key = `place-region:${round(lat)},${round(lng)}`;
  const cached = await getCached<CountryResult>(supabase, key);
  if (cached) return cached;

  const data = await callGoogleGeocode({ latlng: `${lat},${lng}` });
  if (data.status !== "OK" || !data.results?.length) return null;

  const country = regionFromGeocodeResults(data.results);
  if (!country) return null;

  const result: CountryResult = { country };
  await setCached(supabase, key, result);
  return result;
}

export interface TownResult {
  name: string;
  searchQuery: string;
  lat: number;
  lng: number;
}

// For the "Closest Town" pin/driving-time (useListingMap) — was also a
// client-side Geocoder call per house per page view. Same caching
// treatment; the locality-extraction logic itself is unchanged from
// lib/loadGoogleMaps.ts's own reverseGeocodeTown, just fed the REST
// response shape (plain lat/lng numbers) instead of the JS SDK's
// LatLng objects.
export async function getOrComputeTown(supabase: SupabaseClient, lat: number, lng: number): Promise<TownResult | null> {
  const key = `town:${round(lat)},${round(lng)}`;
  const cached = await getCached<TownResult>(supabase, key);
  if (cached) return cached;

  const data = await callGoogleGeocode({ latlng: `${lat},${lng}` });
  if (data.status !== "OK" || !data.results?.length) return null;

  const townResult = ["locality", "postal_town", "administrative_area_level_3"]
    .map((type) => data.results.find((r) => r.types.includes(type)))
    .find(Boolean);
  if (!townResult) return null;

  const nameComp = townResult.address_components[0];
  const stateComp = townResult.address_components.find((c) => c.types.includes("administrative_area_level_1"));
  const result: TownResult = {
    name: nameComp.long_name,
    searchQuery: stateComp ? `${nameComp.long_name}, ${stateComp.long_name}` : nameComp.long_name,
    lat: townResult.geometry.location.lat,
    lng: townResult.geometry.location.lng,
  };
  await setCached(supabase, key, result);
  return result;
}

export interface ForwardGeocodeResult {
  lat: number;
  lng: number;
  formattedAddress: string;
}

// For "type an address, find its coordinates" (AddEntryForm's manual-
// entry flow, EntryCard's own edit-mode "Find coordinates", trip
// settings' point-of-interest picker) — much lower volume than the two
// above (a one-off action, not something re-run on every page view),
// but cheap to cache the same way given the infrastructure already
// exists, and helps the case of the same address getting typed again
// later (a different trip's stay at the same rental, a retried typo
// fix).
export async function getOrComputeForwardGeocode(supabase: SupabaseClient, address: string): Promise<ForwardGeocodeResult | null> {
  const key = `forward:${address.trim().toLowerCase()}`;
  const cached = await getCached<ForwardGeocodeResult>(supabase, key);
  if (cached) return cached;

  const data = await callGoogleGeocode({ address });
  if (data.status !== "OK" || !data.results?.[0]) return null;

  const r = data.results[0];
  const result: ForwardGeocodeResult = {
    lat: r.geometry.location.lat,
    lng: r.geometry.location.lng,
    formattedAddress: r.formatted_address,
  };
  await setCached(supabase, key, result);
  return result;
}
