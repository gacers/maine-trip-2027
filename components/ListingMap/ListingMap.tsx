"use client";

import { useEffect, useRef, useState } from "react";
import { useGoogleMaps, type GoogleMapsApi } from "@/lib/useGoogleMaps";
import { reverseGeocodeTown, type TownResult } from "@/lib/loadGoogleMaps";
import type { LatLngLabel, MapReferencePoint, MapConfig } from "@/lib/types";
import styles from "./ListingMap.module.css";

const DEFAULT_TOWN_COLOR = "#1976D2";
const DEFAULT_HOUSE_COLOR = "#CC0000";

function starIcon(google: GoogleMapsApi, color: string) {
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24">' +
    '<path d="M12 2l2.9 6.26L21.5 9.27l-4.75 4.63L17.9 21 12 17.77 6.1 21l1.15-7.1L2.5 9.27l6.6-1.01z" ' +
    `fill="${color}" stroke="#ffffff" stroke-width="1"/></svg>`;
  return {
    url: "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svg),
    scaledSize: new google.maps.Size(40, 40),
    anchor: new google.maps.Point(20, 20),
  };
}

// Straight-line (haversine) distance in miles — plenty good enough for
// just picking the nearest option out of a trip's mapConfig.closestOf
// list; the Directions API still computes the real driving time/distance
// shown to the user.
function distance(a: LatLngLabel, b: LatLngLabel): number {
  const R = 3958.8;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function closestOf(house: LatLngLabel, options: MapReferencePoint[]): MapReferencePoint | null {
  if (!options || options.length === 0) return null;
  return options.reduce((best, opt) => (distance(house, opt) < distance(house, best) ? opt : best));
}

// `houses` is one or more { lat, lng, label } points. A solo listing passes
// a single-item array; a 2-house-option group passes both houses so they
// share one map, one set of reference-point pins, and one set of driving
// times (computed from the first house — the two are always close together
// by definition, so this stays accurate enough to be useful).
//
// `mapConfig` is a trip's own reference points (trips.map_config in
// Supabase) rather than a hardcoded import, so every trip can have its
// own set without a code change:
//   { alwaysShown: [{lat,lng,label,color}, ...]   — always shown, e.g. a park
//     closestOf:   [{lat,lng,label,color}, ...]   — only the nearest one shown
//     originLabel: "Brooklyn, NY"                 — extra "X -> house" driving time
//     houseColor, townColor }
//
// An `alwaysShown` point can also opt into the closestOf competition
// (`joinClosestOf: true`) when it offers the same kind of thing as the
// closestOf options but has another reason to always have a pin regardless
// (e.g. Stonington's ferry to Isle Au Haut also runs a puffin tour — it
// should always show a pin, but only claim "& puffin tour" in its label
// when it's genuinely the closest one, via its own `closestLabel`).
function computeClosestOfWinner(house: LatLngLabel, config: MapConfig): MapReferencePoint | null {
  const candidates = [...(config.closestOf || []), ...(config.alwaysShown || []).filter((p) => p.joinClosestOf)];
  return closestOf(house, candidates);
}

interface RouteInfo {
  text: string;
  url: string;
  color?: string;
}

export interface ListingMapProps {
  houses: LatLngLabel[];
  extraMarkers?: MapReferencePoint[];
  mapConfig?: MapConfig;
}

export default function ListingMap({ houses, extraMarkers, mapConfig }: ListingMapProps) {
  const mapDivRef = useRef<HTMLDivElement>(null);
  const { google, status, errorMsg } = useGoogleMaps();
  const [routeInfo, setRouteInfo] = useState<Record<string, RouteInfo>>({});
  const [originInfo, setOriginInfo] = useState<RouteInfo | null>(null);
  const [closestTown, setClosestTown] = useState<TownResult | null>(null);

  const config = mapConfig || {};
  const houseColor = config.houseColor || DEFAULT_HOUSE_COLOR;
  const townColor = config.townColor || DEFAULT_TOWN_COLOR;

  const referenceHouse = houses[0];
  const closestOfWinner = computeClosestOfWinner(referenceHouse, config);
  // alwaysShown pins that opted in via joinClosestOf swap to their
  // closestLabel only when they're the one that actually won; everyone
  // else keeps their normal label.
  const alwaysShownResolved = (config.alwaysShown || []).map((p) =>
    p.joinClosestOf && closestOfWinner === p && p.closestLabel ? { ...p, label: p.closestLabel } : p
  );
  // Only add a separate closestOf pin when the winner isn't already one of
  // the alwaysShown points above (which is already on the map either way).
  const closestOfPin = closestOfWinner && !closestOfWinner.joinClosestOf ? closestOfWinner : null;
  const destinations: MapReferencePoint[] = [
    ...alwaysShownResolved,
    ...(closestOfPin ? [closestOfPin] : []),
    ...(extraMarkers || []),
    ...(closestTown
      ? [{ lat: closestTown.lat, lng: closestTown.lng, label: closestTown.name, color: townColor }]
      : []),
  ];
  const housesKey = houses.map((h) => `${h.lat},${h.lng}`).join("|");

  // Resolved separately from the main map effect below since it's an
  // extra async lookup (reverse geocoding), not just drawing already-known
  // points — once it resolves, closestTown feeds back into `destinations`
  // above and the main effect re-runs to add its pin + driving time.
  useEffect(() => {
    let cancelled = false;
    reverseGeocodeTown(referenceHouse.lat, referenceHouse.lng)
      .then((town) => {
        if (!cancelled) setClosestTown(town);
      })
      .catch(() => {
        // Non-fatal — the rest of the map/driving-times still work fine
        // without a resolved closest town.
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [housesKey]);

  useEffect(() => {
    if (!google || !mapDivRef.current) return;
    let cancelled = false;

    const map = new google.maps.Map(mapDivRef.current, {
      zoom: 9,
      center: referenceHouse,
    });

    const bounds = new google.maps.LatLngBounds();

    houses.forEach((h) => {
      new google.maps.Marker({
        position: h,
        map,
        title: h.label || "House",
        zIndex: 999,
        icon: starIcon(google, houseColor),
      });
      bounds.extend(h);
    });

    const directionsService = new google.maps.DirectionsService();
    const newRouteInfo: Record<string, RouteInfo> = {};

    destinations.forEach((dest, i) => {
      new google.maps.Marker({
        position: { lat: dest.lat, lng: dest.lng },
        map,
        title: dest.label,
        label: { text: String.fromCharCode(65 + i), color: "#ffffff", fontWeight: "bold" },
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 10,
          fillColor: dest.color,
          fillOpacity: 1,
          strokeColor: "#ffffff",
          strokeWeight: 2,
        },
      });
      bounds.extend({ lat: dest.lat, lng: dest.lng });

      // Just compute duration/distance for the Driving Times list below —
      // no route polyline drawn on the map itself, just the pins.
      directionsService.route(
        {
          origin: referenceHouse,
          destination: { lat: dest.lat, lng: dest.lng },
          travelMode: google.maps.TravelMode.DRIVING,
        },
        (
          result: { routes: { legs: { duration: { text: string }; distance: { text: string } }[] }[] },
          routeStatus: string
        ) => {
          if (cancelled) return;
          if (routeStatus === "OK") {
            const leg = result.routes[0].legs[0];
            newRouteInfo[dest.label] = {
              text: `${leg.duration.text} (${leg.distance.text})`,
              url: `https://www.google.com/maps/dir/?api=1&origin=${referenceHouse.lat},${referenceHouse.lng}&destination=${dest.lat},${dest.lng}`,
              color: dest.color,
            };
          } else {
            newRouteInfo[dest.label] = {
              text: "Couldn't get directions",
              url: `https://www.google.com/maps/dir/?api=1&origin=${referenceHouse.lat},${referenceHouse.lng}&destination=${dest.lat},${dest.lng}`,
              color: dest.color,
            };
          }
          setRouteInfo({ ...newRouteInfo });
        }
      );
    });

    map.fitBounds(bounds);
    google.maps.event.addListenerOnce(map, "bounds_changed", () => {
      if (map.getZoom() > 11) map.setZoom(11);
    });

    // Origin -> house: real duration/distance, not drawn on this
    // zoomed-in local map. Only if this trip defines one.
    if (config.originLabel) {
      directionsService.route(
        {
          origin: config.originLabel,
          destination: referenceHouse,
          travelMode: google.maps.TravelMode.DRIVING,
        },
        (
          result: { routes: { legs: { duration: { text: string }; distance: { text: string } }[] }[] },
          routeStatus: string
        ) => {
          if (cancelled) return;
          if (routeStatus === "OK") {
            const leg = result.routes[0].legs[0];
            setOriginInfo({
              text: `${leg.duration.text} (${leg.distance.text})`,
              url: `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(
                config.originLabel!
              )}&destination=${referenceHouse.lat},${referenceHouse.lng}`,
            });
          } else {
            setOriginInfo({
              text: "Couldn't get directions",
              url: `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(
                config.originLabel!
              )}&destination=${referenceHouse.lat},${referenceHouse.lng}`,
            });
          }
        }
      );
    }

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [google, housesKey, closestTown]);

  const liveMapUrl =
    "https://www.google.com/maps/dir/" + [...houses, ...destinations].map((p) => `${p.lat},${p.lng}`).join("/");

  return (
    <div className={styles.wrapper}>
      <h3 className={styles.heading}>
        <a href={liveMapUrl} target="_blank" rel="noopener noreferrer" className={styles.link}>
          Map
        </a>
      </h3>

      {status === "error" ? (
        <p className={styles.errorBox}>
          Couldn&apos;t load the map ({errorMsg}). Check that NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is set.
        </p>
      ) : (
        <div ref={mapDivRef} className={styles.mapCanvas} />
      )}

      <ul className={styles.legend}>
        {houses.map((h) => (
          <li key={h.label} className={styles.legendItem}>
            <span className={styles.legendDot} style={{ background: houseColor }} />
            {h.label}
          </li>
        ))}
        {destinations.map((dest) => (
          <li key={dest.label} className={styles.legendItem}>
            <span className={styles.legendDot} style={{ background: dest.color }} />
            {dest.label}
          </li>
        ))}
      </ul>

      {closestTown && (
        <div>
          <h3 className={styles.headingSpaced}>Closest Town</h3>
          <a
            href={`https://www.google.com/search?q=${encodeURIComponent(closestTown.searchQuery)}`}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.link}
          >
            {closestTown.name}
          </a>
        </div>
      )}

      <div>
        <h3 className={styles.headingSpaced}>Driving Times</h3>
        <ul className={styles.drivingTimesList}>
          {originInfo && (
            <li>
              <a href={originInfo.url} target="_blank" rel="noopener noreferrer" className={styles.link}>
                {config.originLabel} &rarr; house: {originInfo.text}
              </a>
            </li>
          )}
          {destinations.map((dest) => {
            const info = routeInfo[dest.label];
            return (
              <li key={dest.label}>
                {info ? (
                  <a href={info.url} target="_blank" rel="noopener noreferrer" className={styles.link}>
                    House &rarr; {dest.label}: {info.text}
                  </a>
                ) : (
                  <span className={styles.loadingRow}>House &rarr; {dest.label}: loading...</span>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
