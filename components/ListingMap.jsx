"use client";

import { useEffect, useRef, useState } from "react";
import { useGoogleMaps } from "@/lib/useGoogleMaps";
import { reverseGeocodeTown } from "@/lib/loadGoogleMaps";
import {
  ACADIA,
  STONINGTON,
  BROOKLYN_ORIGIN,
  HOUSE_COLOR,
  TOWN_COLOR,
  closestOtherPuffinTour,
} from "@/lib/mapConstants";

function starIcon(google, color) {
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

// `houses` is one or more { lat, lng, label } points. A solo listing passes
// a single-item array; a 2-house-option group passes both houses so they
// share one map, one set of reference-point pins, and one set of driving
// times (computed from the first house — the two are always close together
// by definition, so this stays accurate enough to be useful).
export default function ListingMap({ houses, extraMarkers }) {
  const mapDivRef = useRef(null);
  const { google, status, errorMsg } = useGoogleMaps();
  const [routeInfo, setRouteInfo] = useState({}); // label -> { text, url }
  const [brooklynInfo, setBrooklynInfo] = useState(null);
  const [closestTown, setClosestTown] = useState(null); // { name, searchQuery, lat, lng }

  const referenceHouse = houses[0];
  const destinations = [
    ACADIA,
    STONINGTON,
    closestOtherPuffinTour(referenceHouse),
    ...(extraMarkers || []),
    ...(closestTown ? [{ lat: closestTown.lat, lng: closestTown.lng, label: closestTown.name, color: TOWN_COLOR }] : []),
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
        icon: starIcon(google, HOUSE_COLOR),
      });
      bounds.extend(h);
    });

    const directionsService = new google.maps.DirectionsService();
    const newRouteInfo = {};

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
        (result, routeStatus) => {
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

    // Brooklyn -> house: real duration/distance, not drawn on this
    // zoomed-in local map.
    directionsService.route(
      {
        origin: BROOKLYN_ORIGIN,
        destination: referenceHouse,
        travelMode: google.maps.TravelMode.DRIVING,
      },
      (result, routeStatus) => {
        if (cancelled) return;
        if (routeStatus === "OK") {
          const leg = result.routes[0].legs[0];
          setBrooklynInfo({
            text: `${leg.duration.text} (${leg.distance.text})`,
            url: `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(
              BROOKLYN_ORIGIN
            )}&destination=${referenceHouse.lat},${referenceHouse.lng}`,
          });
        } else {
          setBrooklynInfo({
            text: "Couldn't get directions",
            url: `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(
              BROOKLYN_ORIGIN
            )}&destination=${referenceHouse.lat},${referenceHouse.lng}`,
          });
        }
      }
    );

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [google, housesKey, closestTown]);

  const liveMapUrl =
    "https://www.google.com/maps/dir/" +
    [...houses, ...destinations].map((p) => `${p.lat},${p.lng}`).join("/");

  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm uppercase tracking-wide text-zinc-500 font-medium">
        <a href={liveMapUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
          Map
        </a>
      </h3>

      {status === "error" ? (
        <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
          Couldn&apos;t load the map ({errorMsg}). Check that
          NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is set.
        </p>
      ) : (
        <div ref={mapDivRef} className="w-full h-64 sm:h-72 rounded-lg bg-zinc-100" />
      )}

      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
        {houses.map((h) => (
          <li key={h.label} className="flex items-center gap-1.5">
            <span
              className="inline-block w-3 h-3 rounded-full shrink-0"
              style={{ background: HOUSE_COLOR }}
            />
            {h.label}
          </li>
        ))}
        {destinations.map((dest) => (
          <li key={dest.label} className="flex items-center gap-1.5">
            <span
              className="inline-block w-3 h-3 rounded-full shrink-0"
              style={{ background: dest.color }}
            />
            {dest.label}
          </li>
        ))}
      </ul>

      {closestTown && (
        <div>
          <h3 className="text-sm uppercase tracking-wide text-zinc-500 font-medium mt-2 mb-1">
            Closest Town
          </h3>
          <a
            href={`https://www.google.com/search?q=${encodeURIComponent(closestTown.searchQuery)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-blue-600 hover:underline"
          >
            {closestTown.name}
          </a>
        </div>
      )}

      <div>
        <h3 className="text-sm uppercase tracking-wide text-zinc-500 font-medium mt-2 mb-1">
          Driving Times
        </h3>
        <ul className="text-sm flex flex-col gap-1">
          {brooklynInfo && (
            <li>
              <a href={brooklynInfo.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                Brooklyn &rarr; house: {brooklynInfo.text}
              </a>
            </li>
          )}
          {destinations.map((dest) => {
            const info = routeInfo[dest.label];
            return (
              <li key={dest.label}>
                {info ? (
                  <a href={info.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                    House &rarr; {dest.label}: {info.text}
                  </a>
                ) : (
                  <span className="text-zinc-400">House &rarr; {dest.label}: loading...</span>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
