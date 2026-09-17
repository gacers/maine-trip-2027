"use client";

import type { TravelMode } from "@/lib/types";

// Client-side wrapper around this trip's own /directions route (see
// app/api/trips/[tripSlug]/directions/route.ts + lib/routeCache.ts) —
// the general-purpose sibling of the itinerary's own directions client
// call (RouteConnector.tsx), for the ordinary house-to-town/reference-
// point driving times shown on a regular listing card (useListingMap).

export interface RouteResult {
  text: string;
  url: string;
}

export async function fetchRoute(
  tripSlug: string,
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
  travelMode: TravelMode = "driving"
): Promise<RouteResult | null> {
  const res = await fetch(`/api/trips/${tripSlug}/directions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ from, to, travelMode }),
  });
  if (!res.ok) return null;
  return res.json();
}
