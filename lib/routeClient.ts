"use client";

import type { TravelMode } from "@/lib/types";

// Client-side wrapper around this trip's own /directions route (see
// app/api/trips/[tripSlug]/directions/route.ts + lib/routeCache.ts) —
// the general-purpose sibling of the itinerary's own directions client
// call (RouteConnector.tsx), for the ordinary house-to-town/reference-
// point driving times shown on a regular listing card (useListingMap).
// That route requires real access (requireReadAccess) same as
// lib/geocodeClient.ts's own routes — an admin/editor's session cookie
// rides along automatically, a contributor needs their token passed in
// explicitly or the request just 401s.

export interface RouteResult {
  text: string;
  url: string;
  durationSeconds: number;
}

export async function fetchRoute(
  tripSlug: string,
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
  travelMode: TravelMode = "driving",
  authToken?: string | null
): Promise<RouteResult | null> {
  const res = await fetch(`/api/trips/${tripSlug}/directions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}) },
    body: JSON.stringify({ from, to, travelMode }),
  });
  if (!res.ok) return null;
  return res.json();
}
