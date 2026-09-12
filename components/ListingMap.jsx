"use client";

import { useEffect, useRef, useState } from "react";
import { loadGoogleMaps } from "@/lib/loadGoogleMaps";
import { FIXED_DESTINATIONS, BROOKLYN_ORIGIN, HOUSE_COLOR } from "@/lib/mapConstants";

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

export default function ListingMap({ house, houseLabel, extraMarkers }) {
  const mapDivRef = useRef(null);
  const [status, setStatus] = useState("loading"); // loading | ready | error
  const [errorMsg, setErrorMsg] = useState("");
  const [routeInfo, setRouteInfo] = useState({}); // label -> { text, url }
  const [brooklynInfo, setBrooklynInfo] = useState(null);

  const destinations = [...FIXED_DESTINATIONS, ...(extraMarkers || [])];

  useEffect(() => {
    let cancelled = false;

    loadGoogleMaps()
      .then((google) => {
        if (cancelled || !mapDivRef.current) return;

        const map = new google.maps.Map(mapDivRef.current, {
          zoom: 9,
          center: house,
        });

        new google.maps.Marker({
          position: house,
          map,
          title: houseLabel || "House",
          zIndex: 999,
          icon: starIcon(google, HOUSE_COLOR),
        });

        const bounds = new google.maps.LatLngBounds();
        bounds.extend(house);

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

          const renderer = new google.maps.DirectionsRenderer({
            map,
            suppressMarkers: true,
            preserveViewport: true,
            polylineOptions: { strokeColor: dest.color, strokeWeight: 4, strokeOpacity: 0.8 },
          });

          directionsService.route(
            {
              origin: house,
              destination: { lat: dest.lat, lng: dest.lng },
              travelMode: google.maps.TravelMode.DRIVING,
            },
            (result, routeStatus) => {
              if (cancelled) return;
              if (routeStatus === "OK") {
                renderer.setDirections(result);
                const leg = result.routes[0].legs[0];
                newRouteInfo[dest.label] = {
                  text: `${leg.duration.text} (${leg.distance.text})`,
                  url: `https://www.google.com/maps/dir/?api=1&origin=${house.lat},${house.lng}&destination=${dest.lat},${dest.lng}`,
                  color: dest.color,
                };
              } else {
                newRouteInfo[dest.label] = {
                  text: "Couldn't get directions",
                  url: `https://www.google.com/maps/dir/?api=1&origin=${house.lat},${house.lng}&destination=${dest.lat},${dest.lng}`,
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
            destination: house,
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
                )}&destination=${house.lat},${house.lng}`,
              });
            } else {
              setBrooklynInfo({
                text: "Couldn't get directions",
                url: `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(
                  BROOKLYN_ORIGIN
                )}&destination=${house.lat},${house.lng}`,
              });
            }
          }
        );

        setStatus("ready");
      })
      .catch((err) => {
        if (!cancelled) {
          setStatus("error");
          setErrorMsg(err.message);
        }
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [house.lat, house.lng]);

  const liveMapUrl =
    "https://www.google.com/maps/dir/" +
    [house, ...destinations].map((p) => `${p.lat},${p.lng}`).join("/");

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
        <li className="flex items-center gap-1.5">
          <span
            className="inline-block w-3 h-3 rounded-full shrink-0"
            style={{ background: HOUSE_COLOR }}
          />
          {houseLabel || "House (approximate location)"}
        </li>
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
