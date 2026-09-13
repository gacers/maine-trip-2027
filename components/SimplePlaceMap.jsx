"use client";

import { useEffect, useRef } from "react";
import { useGoogleMaps } from "@/lib/useGoogleMaps";

// A plain marker map for an entry that isn't being actively compared
// against other options (a "previous"/already-decided section — see
// SectionPage's comparisonMode) — just the pin(s) and a link to open
// the real Google Maps app/site, no Directions API calls for driving
// times and no reverse-geocoded "Closest Town" the way ListingMap does
// for a still-deciding section. `places` is one or more {lat, lng,
// label}, matching ListingMap's `houses` shape so a group of 2 renders
// on one shared map the same way GroupMap does for the full version.
export default function SimplePlaceMap({ places }) {
  const mapDivRef = useRef(null);
  const { google, status, errorMsg } = useGoogleMaps();
  const key = places.map((p) => `${p.lat},${p.lng}`).join("|");

  useEffect(() => {
    if (!google || !mapDivRef.current) return;
    const map = new google.maps.Map(mapDivRef.current, { zoom: 13, center: places[0] });
    const bounds = new google.maps.LatLngBounds();
    places.forEach((p) => {
      new google.maps.Marker({ position: p, map, title: p.label });
      bounds.extend(p);
    });
    if (places.length > 1) map.fitBounds(bounds);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [google, key]);

  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm uppercase tracking-wide text-zinc-500 font-medium">Map</h3>

      {status === "error" ? (
        <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
          Couldn&apos;t load the map ({errorMsg}).
        </p>
      ) : (
        <div ref={mapDivRef} className="w-full h-48 sm:h-56 rounded-lg bg-zinc-100" />
      )}

      <ul className="flex flex-col gap-1 text-sm">
        {places.map((p) => (
          <li key={p.label}>
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lng}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              {p.label} — Open in Google Maps
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
