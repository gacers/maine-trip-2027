import { loadGoogleMaps } from "@/lib/loadGoogleMaps";
import type { ItineraryStop, TravelMode } from "@/lib/types";

export interface TimingCandidate {
  date: string;
  /** "HH:MM", possibly with seconds — either is fine. */
  time: string;
  lat: number | null;
  lng: number | null;
  travelMode: TravelMode;
}

// Checks whether `candidate`'s own date/time is even reachable from
// `previous` — its date/time plus its duration, plus however long the
// drive/transit/walk between them actually takes. Confirmed live: it's
// easy to enter two times 15 minutes apart that are actually a 3+ hour
// drive apart, with nothing catching it. Skips the check (returns
// null, never blocks) whenever there isn't enough to check with — no
// previous stop, either side missing a date/time or coordinates, or
// the Directions call itself fails — this is a sanity check on data
// you already have, not a hard requirement to have entered it all.
export async function findTimingConflict(previous: ItineraryStop | null, candidate: TimingCandidate): Promise<string | null> {
  if (!previous?.date || !previous.time || !candidate.date || !candidate.time) return null;
  if (previous.lat == null || previous.lng == null || candidate.lat == null || candidate.lng == null) return null;

  const google = await loadGoogleMaps().catch(() => null);
  if (!google) return null;

  const travelSeconds = await new Promise<number | null>((resolve) => {
    const directionsService = new google.maps.DirectionsService();
    const modeKey = candidate.travelMode.toUpperCase() as keyof typeof google.maps.TravelMode;
    directionsService.route(
      {
        origin: { lat: previous.lat!, lng: previous.lng! },
        destination: { lat: candidate.lat!, lng: candidate.lng! },
        travelMode: google.maps.TravelMode[modeKey],
      },
      (result: { routes: { legs: { duration: { value: number } }[] }[] } | null, status: string) => {
        resolve(status === "OK" && result ? result.routes[0].legs[0].duration.value : null);
      }
    );
  });
  if (travelSeconds == null) return null;

  const departure = new Date(`${previous.date}T${previous.time.slice(0, 5)}:00`);
  departure.setMinutes(departure.getMinutes() + (previous.duration_minutes || 0));
  const earliestArrival = new Date(departure.getTime() + travelSeconds * 1000);

  const candidateStart = new Date(`${candidate.date}T${candidate.time.slice(0, 5)}:00`);
  if (candidateStart >= earliestArrival) return null;

  const fmtTime = (d: Date) => d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  const crossesDay = earliestArrival.toDateString() !== departure.toDateString();
  const fmtArrival = crossesDay
    ? `${fmtTime(earliestArrival)} on ${earliestArrival.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`
    : fmtTime(earliestArrival);
  return `That's before you could realistically get here from "${previous.title}" — the earliest you'd arrive given the drive is around ${fmtArrival}. Pick a later time, or double-check the location.`;
}
