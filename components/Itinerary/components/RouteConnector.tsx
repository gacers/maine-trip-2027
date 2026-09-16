"use client";

import { useEffect, useState } from "react";
import { loadGoogleMaps } from "@/lib/loadGoogleMaps";
import type { TravelMode } from "@/lib/types";
import styles from "./RouteConnector.module.css";

export interface RouteConnectorProps {
  from: { lat: number; lng: number };
  to: { lat: number; lng: number };
  travelMode: TravelMode;
}

const TRAVEL_MODE_LABEL: Record<TravelMode, string> = {
  driving: "drive",
  walking: "walk",
  transit: "transit",
  bicycling: "bike",
};

// An overlay, not the primary way a leg is represented — only rendered
// by ItineraryPage when both neighboring stops actually have lat/lng
// (a flight/ferry stop describes its own travel via notes/url instead;
// there's nothing for the Directions API to compute there). Same
// DirectionsService call shape as ListingMap/useListingMap.ts, just
// chained stop-to-stop instead of one house to many destinations.
// Fails silently (renders nothing) rather than an error banner — this
// is a nice-to-have planning aid, not information the page depends on.
export default function RouteConnector({ from, to, travelMode }: RouteConnectorProps) {
  const [info, setInfo] = useState<{ text: string; url: string } | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setInfo(null);
    setFailed(false);

    loadGoogleMaps()
      .then((google) => {
        if (!google || cancelled) return;
        const directionsService = new google.maps.DirectionsService();
        const modeKey = travelMode.toUpperCase() as keyof typeof google.maps.TravelMode;
        directionsService.route(
          {
            origin: from,
            destination: to,
            travelMode: google.maps.TravelMode[modeKey],
          },
          (
            result: { routes: { legs: { duration: { text: string }; distance: { text: string } }[] }[] } | null,
            status: string
          ) => {
            if (cancelled) return;
            if (status === "OK" && result) {
              const leg = result.routes[0].legs[0];
              setInfo({
                text: `${leg.duration.text} (${leg.distance.text})`,
                url: `https://www.google.com/maps/dir/?api=1&origin=${from.lat},${from.lng}&destination=${to.lat},${to.lng}&travelmode=${travelMode}`,
              });
            } else {
              setFailed(true);
            }
          }
        );
      })
      .catch(() => setFailed(true));

    return () => {
      cancelled = true;
    };
    // Depend on the primitive coordinates, not `from`/`to` themselves —
    // ItineraryPage passes fresh object literals every render, which
    // would otherwise re-trigger this on every render regardless of
    // whether the actual leg changed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from.lat, from.lng, to.lat, to.lng, travelMode]);

  if (failed) return null;

  return (
    <div className={styles["root"]}>
      {info ? (
        <a href={info.url} target="_blank" rel="noopener noreferrer" className={styles["link"]}>
          ↓ {info.text} {TRAVEL_MODE_LABEL[travelMode]}
        </a>
      ) : (
        <span className={styles["loading"]}>↓ calculating...</span>
      )}
    </div>
  );
}
