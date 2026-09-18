"use client";

import { useQuery } from "@tanstack/react-query";
import { ITINERARY_TRAVEL_MODE_CONNECTOR_LABEL, toGoogleTravelMode } from "@/lib/itineraryTravelMode";
import type { ItineraryTravelMode } from "@/lib/types";
import styles from "./RouteConnector.module.css";

export interface RouteConnectorProps {
  tripSlug: string;
  authToken: string | null;
  from: { lat: number; lng: number };
  to: { lat: number; lng: number };
  travelMode: ItineraryTravelMode;
  /** The arriving stop's own date/time, if it has one — lets this show
   * "Leave by 2:15 PM" (that time minus the drive) alongside the drive
   * time itself. Omitted (no estimate shown) when the next stop has no
   * set time to work backward from. */
  toDate?: string | null;
  toTime?: string | null;
}

// A day this route caching was introduced, roughly — not read anywhere,
// just so staleTime below has an obvious reason attached to it rather
// than a bare number.
const A_DAY = 24 * 60 * 60 * 1000;

function formatLeaveBy(toDate: string, toTime: string, durationSeconds: number): string | null {
  const arrival = new Date(`${toDate}T${toTime.slice(0, 5)}:00`);
  if (Number.isNaN(arrival.getTime())) return null;
  const leaveBy = new Date(arrival.getTime() - durationSeconds * 1000);
  return leaveBy.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

// An overlay, not the primary way a leg is represented — only rendered
// by ItineraryPage when both neighboring stops actually have lat/lng
// (a flight/ferry stop describes its own travel via notes/url instead;
// there's nothing for the Directions API to compute there).
//
// Used to call google.maps.DirectionsService directly, client-side, on
// every mount — recomputed fresh on every page view, by every visitor,
// forever (Directions is billed per call regardless of who's asking).
// Now a plain fetch to /itinerary/directions, which checks a server-
// side cache (route_cache — see lib/routeCache.ts) before ever asking
// Google for real, so the *whole app's* combined Directions usage for
// a given stop-pair drops to roughly one real call ever (until that
// mode's own TTL expires), not one per page view. useQuery on top of
// that just avoids asking our own API again for the same pair within
// this browser's own session (e.g. flipping between two itineraries
// and back) — a much longer staleTime than the rest of the app's
// queries (SectionPage's own entries are 60s) since a drive time
// between two fixed points is nowhere near as likely to change
// mid-session as trip content is.
export default function RouteConnector({ tripSlug, authToken, from, to, travelMode, toDate, toTime }: RouteConnectorProps) {
  // car_service isn't a real Directions mode (see toGoogleTravelMode) —
  // sent as "driving" to the API (which validates against Google's own
  // 4 modes), the cache key it hits and the actual leg computed are
  // identical to a plain driving connector either way.
  const googleMode = toGoogleTravelMode(travelMode);
  const { data, isError } = useQuery({
    queryKey: ["itineraryDirections", tripSlug, from.lat, from.lng, to.lat, to.lng, googleMode] as const,
    queryFn: async () => {
      const res = await fetch(`/api/trips/${tripSlug}/itinerary/directions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        },
        body: JSON.stringify({ from, to, travelMode: googleMode }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Route lookup failed");
      return body as { text: string; url: string; durationSeconds: number };
    },
    staleTime: A_DAY,
    gcTime: A_DAY,
    retry: 1,
  });

  if (isError) return null;

  const leaveBy = data && toDate && toTime ? formatLeaveBy(toDate, toTime, data.durationSeconds) : null;

  return (
    <div className={styles["root"]}>
      {data ? (
        <>
          <a href={data.url} target="_blank" rel="noopener noreferrer" className={styles["link"]}>
            ↓ {data.text} {ITINERARY_TRAVEL_MODE_CONNECTOR_LABEL[travelMode]}
          </a>
          {leaveBy && <span className={styles["leave-by"]}>Leave by {leaveBy}</span>}
        </>
      ) : (
        <span className={styles["loading"]}>↓ calculating...</span>
      )}
    </div>
  );
}
