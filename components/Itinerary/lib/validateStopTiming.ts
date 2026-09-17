import { fetchRoute } from "@/lib/routeClient";
import { toGoogleTravelMode } from "@/lib/itineraryTravelMode";
import type { ItineraryStop, ItineraryTravelMode } from "@/lib/types";

export interface TimingCandidate {
  date: string;
  /** "HH:MM", possibly with seconds — either is fine. */
  time: string;
  lat: number | null;
  lng: number | null;
  travelMode: ItineraryTravelMode;
}

// Shared by findTimingConflict below and StopCard's own "leave by"
// estimate — the earliest you could actually arrive at `to`, given
// departing `from` (its own date/time plus duration) and however long
// the leg between them takes. Returns null whenever there isn't enough
// to compute with (missing date/time/coordinates) or the Directions
// lookup itself comes back empty — a sanity check on data you already
// have, not a hard requirement to have entered it all. Used to call
// google.maps.DirectionsService directly, client-side, uncached, on
// every save — now goes through this trip's own cached /directions
// route (see lib/routeCache.ts) like everything else. car_service maps
// to "driving" for the actual lookup (see toGoogleTravelMode) — same
// roads, same drive time, just labeled differently to the user.
export async function computeEarliestArrival(
  tripSlug: string,
  from: { date: string | null; time: string | null; lat: number | null; lng: number | null; duration_minutes: number | null },
  to: { lat: number | null; lng: number | null; travelMode: ItineraryTravelMode }
): Promise<{ earliestArrival: Date; travelSeconds: number } | null> {
  if (!from.date || !from.time || from.lat == null || from.lng == null || to.lat == null || to.lng == null) return null;

  const route = await fetchRoute(
    tripSlug,
    { lat: from.lat, lng: from.lng },
    { lat: to.lat, lng: to.lng },
    toGoogleTravelMode(to.travelMode)
  ).catch(() => null);
  if (!route) return null;

  const departure = new Date(`${from.date}T${from.time.slice(0, 5)}:00`);
  departure.setMinutes(departure.getMinutes() + (from.duration_minutes || 0));
  const earliestArrival = new Date(departure.getTime() + route.durationSeconds * 1000);
  return { earliestArrival, travelSeconds: route.durationSeconds };
}

// Checks whether `candidate`'s own date/time is even reachable from
// `previous` — its date/time plus its duration, plus however long the
// drive/transit/walk between them actually takes. Confirmed live: it's
// easy to enter two times 15 minutes apart that are actually a 3+ hour
// drive apart, with nothing catching it.
export async function findTimingConflict(
  tripSlug: string,
  previous: ItineraryStop | null,
  candidate: TimingCandidate
): Promise<string | null> {
  if (!previous) return null;
  const result = await computeEarliestArrival(tripSlug, previous, { lat: candidate.lat, lng: candidate.lng, travelMode: candidate.travelMode });
  if (!result) return null;

  const candidateStart = new Date(`${candidate.date}T${candidate.time.slice(0, 5)}:00`);
  if (candidateStart >= result.earliestArrival) return null;

  const fmtTime = (d: Date) => d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  const departure = new Date(`${previous.date}T${previous.time!.slice(0, 5)}:00`);
  const crossesDay = result.earliestArrival.toDateString() !== departure.toDateString();
  const fmtArrival = crossesDay
    ? `${fmtTime(result.earliestArrival)} on ${result.earliestArrival.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`
    : fmtTime(result.earliestArrival);
  return `That's before you could realistically get here from "${previous.title}" — the earliest you'd arrive given the drive is around ${fmtArrival}. Pick a later time, or double-check the location.`;
}
