import type { SupabaseClient } from "@supabase/supabase-js";
import type { TravelMode } from "@/lib/types";

export interface RouteResult {
  /** Already formatted for RouteConnector's own display — e.g.
   * "32 min (18 mi)" — matching exactly what the old client-side
   * DirectionsService call used to build inline. */
  text: string;
  url: string;
  /** Raw seconds, alongside the formatted text above — for anything
   * that needs to do arithmetic with the duration (the itinerary's own
   * "leave by" estimate: nextStop.time minus this), not just display
   * it. */
  durationSeconds: number;
  /** Surfaced for the devtools/debugging only — RouteConnector doesn't
   * change what it renders based on this. */
  cached: boolean;
}

interface CachedRow {
  distance_text: string;
  duration_text: string;
  duration_seconds: number;
  computed_at: string;
}

// How long a cached route stays trustworthy before it's worth
// recomputing. Driving/walking/biking times between two fixed points
// barely drift (a new highway, a road closure here and there) on any
// timescale this app's trips actually plan on — favors "basically
// never re-ask Google for the same pair" over staying perfectly
// current. Transit is the one mode that can genuinely go stale sooner
// (a schedule change), so it gets a much shorter window.
const CACHE_TTL_DAYS: Record<TravelMode, number> = {
  driving: 90,
  walking: 180,
  bicycling: 180,
  transit: 14,
};

// ~1m precision — enough that the same physical place geocoded twice
// with tiny float drift still hits the same cache row, without
// conflating two genuinely different addresses a block apart.
function round(n: number): number {
  return Math.round(n * 1e6) / 1e6;
}

function formatResult(row: CachedRow, url: string, cached: boolean): RouteResult {
  return { text: `${row.duration_text} (${row.distance_text})`, url, durationSeconds: row.duration_seconds, cached };
}

// The one entry point RouteConnector's own API route calls: reuse a
// cached row when one exists and hasn't aged past CACHE_TTL_DAYS for
// this mode, otherwise call Google's Directions API for real and store
// what came back — keyed on rounded coordinates + mode, not per-trip
// (see the route_cache migration's own comment on why). A stale
// Google failure still falls back to the last-known cached value
// rather than surfacing nothing, on the theory that a slightly-outdated
// drive time is still more useful to a trip-planning page than a blank
// connector.
export async function getOrComputeRoute(
  supabase: SupabaseClient,
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
  travelMode: TravelMode
): Promise<RouteResult | null> {
  const originLat = round(from.lat);
  const originLng = round(from.lng);
  const destLat = round(to.lat);
  const destLng = round(to.lng);
  const mapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${from.lat},${from.lng}&destination=${to.lat},${to.lng}&travelmode=${travelMode}`;

  const { data: existing } = await supabase
    .from("route_cache")
    .select("distance_text, duration_text, duration_seconds, computed_at")
    .eq("origin_lat", originLat)
    .eq("origin_lng", originLng)
    .eq("dest_lat", destLat)
    .eq("dest_lng", destLng)
    .eq("travel_mode", travelMode)
    .maybeSingle();

  const ttlMs = CACHE_TTL_DAYS[travelMode] * 24 * 60 * 60 * 1000;
  if (existing && Date.now() - new Date((existing as CachedRow).computed_at).getTime() < ttlMs) {
    return formatResult(existing as CachedRow, mapsUrl, true);
  }

  const computed = await fetchDirectionsFromGoogle(from, to, travelMode);
  if (!computed) {
    // Google failed (transient error, or genuinely no route) — a stale
    // cached value is still better than nothing.
    if (existing) return formatResult(existing as CachedRow, mapsUrl, true);
    return null;
  }

  // Best-effort — a caching write failing shouldn't turn a perfectly
  // good Directions result into an error response.
  await supabase
    .from("route_cache")
    .upsert(
      {
        origin_lat: originLat,
        origin_lng: originLng,
        dest_lat: destLat,
        dest_lng: destLng,
        travel_mode: travelMode,
        distance_text: computed.distanceText,
        duration_text: computed.durationText,
        distance_meters: computed.distanceMeters,
        duration_seconds: computed.durationSeconds,
        computed_at: new Date().toISOString(),
      },
      { onConflict: "origin_lat,origin_lng,dest_lat,dest_lng,travel_mode" }
    )
    .then(({ error }) => {
      if (error) console.error("route_cache upsert failed:", error);
    });

  return {
    text: `${computed.durationText} (${computed.distanceText})`,
    url: mapsUrl,
    durationSeconds: computed.durationSeconds,
    cached: false,
  };
}

interface ComputedRoute {
  distanceText: string;
  durationText: string;
  distanceMeters: number;
  durationSeconds: number;
}

// Server-side REST call (not the client-side google.maps.DirectionsService
// this used to be) — see GOOGLE_MAPS_SERVER_API_KEY's own comment in
// .env.example for why this needs a separate key from the browser one.
async function fetchDirectionsFromGoogle(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
  travelMode: TravelMode
): Promise<ComputedRoute | null> {
  const apiKey = process.env.GOOGLE_MAPS_SERVER_API_KEY;
  if (!apiKey) throw new Error("GOOGLE_MAPS_SERVER_API_KEY is not set");

  const params = new URLSearchParams({
    origin: `${from.lat},${from.lng}`,
    destination: `${to.lat},${to.lng}`,
    mode: travelMode,
    // Without this, Google infers metric/imperial from the origin's
    // own country (e.g. Scotland -> km) rather than the traveler's —
    // this app's own users want miles regardless of which trip it is.
    units: "imperial",
    key: apiKey,
  });
  const res = await fetch(`https://maps.googleapis.com/maps/api/directions/json?${params}`);
  const data = await res.json();
  const leg = data?.routes?.[0]?.legs?.[0];
  if (data?.status !== "OK" || !leg) return null;

  return {
    distanceText: leg.distance.text,
    durationText: leg.duration.text,
    distanceMeters: leg.distance.value,
    durationSeconds: leg.duration.value,
  };
}
