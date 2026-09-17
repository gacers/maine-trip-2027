"use client";

import { useEffect, useRef, useState } from "react";
import { useGoogleMaps, type GoogleMapsApi } from "@/lib/useGoogleMaps";
import { fetchTown, fetchForwardGeocode, type TownResult } from "@/lib/geocodeClient";
import { fetchRoute } from "@/lib/routeClient";
import type { LatLngLabel, MapReferencePoint, MapConfig } from "@/lib/types";

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

export interface RouteInfo {
  text: string;
  url: string;
  color?: string;
}

export interface UseListingMapArgs {
  houses: LatLngLabel[];
  extraMarkers?: MapReferencePoint[];
  mapConfig?: MapConfig;
  /** trip.map_config's reference points (Acadia, closest town, ...),
   * their driving times, and the Directions/Geocoding API calls behind
   * them only make sense for a still-deciding-among-house-options list
   * — Possible Houses. See ListingMap's own doc comment for the full
   * reasoning. */
  showReferencePoints?: boolean;
  /** Skips loading Google Maps/computing anything at all — for a caller
   * that only sometimes needs this (e.g. EntryCard, which calls this
   * hook unconditionally per the Rules of Hooks but only actually wants
   * a map for some entries). */
  enabled?: boolean;
  /** Which trip's own /geocode and /directions routes to call (see
   * lib/geocodeCache.ts/lib/routeCache.ts) — every real caller has one;
   * left optional only so a caller with genuinely nothing to look up
   * doesn't have to pass one. Without it, the town/driving-time lookups
   * below just silently skip (same as `enabled: false`), same reasoning
   * as ListingMap.tsx's own unused-in-practice default export. */
  tripSlug?: string;
  /** A contributor's invite-link token — null for an admin/editor
   * session, which authenticates via cookie instead (see
   * lib/geocodeClient.ts/lib/routeClient.ts's own comments on why this
   * has to be passed explicitly rather than assumed). */
  authToken?: string | null;
}

export interface UseListingMapResult {
  mapDivRef: React.RefObject<HTMLDivElement | null>;
  status: "loading" | "ready" | "error";
  errorMsg: string;
  houses: LatLngLabel[];
  houseColor: string;
  destinations: MapReferencePoint[];
  closestTown: TownResult | null;
  originInfo: RouteInfo | null;
  routeInfo: Record<string, RouteInfo>;
  originLabel?: string;
  liveMapUrl: string;
  showReferencePoints: boolean;
}

// All of ListingMap's actual state/logic (loading the map, drawing
// markers, reverse-geocoding the closest town, computing driving
// times) — pulled out into a hook so a single call's results can feed
// two independent pieces of UI (the map+key itself, and the Closest
// Town/Driving Times details) without duplicating the underlying
// Google Maps instance between them. See ListingMap (the all-in-one,
// backward-compatible default export GroupMap still uses) and
// EntryCard (which calls this directly to render the two pieces as
// separate card sections).
//
// Driving times and the closest-town lookup used to call
// google.maps.DirectionsService/Geocoder directly, client-side, fresh
// on every mount — for every listing card, on every page view, by
// every visitor. Both now go through this trip's own /directions and
// /geocode routes instead, which check a server-side cache
// (route_cache/geocode_cache) before ever asking Google for real — see
// lib/routeCache.ts and lib/geocodeCache.ts. The map itself (drawing
// pins, fitting bounds) still uses the Maps JavaScript API directly;
// there's no equivalent caching for a live embedded map, only for the
// data lookups that used to ride along with it.
export function useListingMap({
  houses,
  extraMarkers,
  mapConfig,
  showReferencePoints = true,
  enabled = true,
  tripSlug,
  authToken,
}: UseListingMapArgs): UseListingMapResult {
  const mapDivRef = useRef<HTMLDivElement>(null);
  const { google, status, errorMsg } = useGoogleMaps();
  const [routeInfo, setRouteInfo] = useState<Record<string, RouteInfo>>({});
  const [originInfo, setOriginInfo] = useState<RouteInfo | null>(null);
  const [closestTown, setClosestTown] = useState<TownResult | null>(null);

  const config = showReferencePoints ? mapConfig || {} : {};
  const houseColor = config.houseColor || DEFAULT_HOUSE_COLOR;
  const townColor = config.townColor || DEFAULT_TOWN_COLOR;

  const referenceHouse = houses[0];
  const closestOfWinner = referenceHouse ? computeClosestOfWinner(referenceHouse, config) : null;
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
  // extra async lookup, not just drawing already-known points — once it
  // resolves, closestTown feeds back into `destinations` above and the
  // main effect re-runs to add its pin + driving time.
  useEffect(() => {
    if (!enabled || !showReferencePoints || !referenceHouse || !tripSlug) return;
    let cancelled = false;
    fetchTown(tripSlug, referenceHouse.lat, referenceHouse.lng, authToken)
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
  }, [housesKey, showReferencePoints, enabled, tripSlug, authToken]);

  useEffect(() => {
    if (!enabled || !google || !mapDivRef.current || !referenceHouse) return;
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
        title: h.label || "Location",
        zIndex: 999,
        icon: starIcon(google, houseColor),
      });
      bounds.extend(h);
    });

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

      if (!showReferencePoints || !tripSlug) return;

      // Just compute duration/distance for the Driving Times list below —
      // no route polyline drawn on the map itself, just the pins.
      const destUrl = `https://www.google.com/maps/dir/?api=1&origin=${referenceHouse.lat},${referenceHouse.lng}&destination=${dest.lat},${dest.lng}`;
      fetchRoute(tripSlug, referenceHouse, { lat: dest.lat, lng: dest.lng }, "driving", authToken)
        .then((route) => {
          if (cancelled) return;
          newRouteInfo[dest.label] = route
            ? { text: route.text, url: destUrl, color: dest.color }
            : { text: "Couldn't get directions", url: destUrl, color: dest.color };
          setRouteInfo({ ...newRouteInfo });
        })
        .catch(() => {
          if (cancelled) return;
          newRouteInfo[dest.label] = { text: "Couldn't get directions", url: destUrl, color: dest.color };
          setRouteInfo({ ...newRouteInfo });
        });
    });

    map.fitBounds(bounds);
    google.maps.event.addListenerOnce(map, "bounds_changed", () => {
      if (map.getZoom() > 11) map.setZoom(11);
    });

    // Origin -> house: real duration/distance, not drawn on this
    // zoomed-in local map. Only if this trip defines one. originLabel is
    // free text (e.g. an airport name), not coordinates — geocoded once
    // (and cached indefinitely, see getOrComputeForwardGeocode) before
    // the actual route lookup, rather than teaching route_cache/
    // getOrComputeRoute to accept a text origin directly.
    if (showReferencePoints && config.originLabel && tripSlug) {
      const originLabel = config.originLabel;
      const originUrl = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(originLabel)}&destination=${referenceHouse.lat},${referenceHouse.lng}`;
      fetchForwardGeocode(tripSlug, originLabel, authToken)
        .then((origin) => {
          if (cancelled) return null;
          return fetchRoute(tripSlug, origin, referenceHouse, "driving", authToken);
        })
        .then((route) => {
          if (cancelled) return;
          setOriginInfo(route ? { text: route.text, url: originUrl } : { text: "Couldn't get directions", url: originUrl });
        })
        .catch(() => {
          if (!cancelled) setOriginInfo({ text: "Couldn't get directions", url: originUrl });
        });
    }

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, google, housesKey, closestTown, tripSlug, authToken]);

  const liveMapUrl =
    "https://www.google.com/maps/dir/" + [...houses, ...destinations].map((p) => `${p.lat},${p.lng}`).join("/");

  return {
    mapDivRef,
    status,
    errorMsg,
    houses,
    houseColor,
    destinations,
    closestTown,
    originInfo,
    routeInfo,
    originLabel: config.originLabel,
    liveMapUrl,
    showReferencePoints,
  };
}
