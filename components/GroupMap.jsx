"use client";

import ListingMap from "./ListingMap";
import { parseExtraMarkers, hasCoords } from "@/lib/listingUtils";

// One shared map + one shared set of driving times for a 2-house-option
// group, instead of duplicating a full map under each card. Both houses'
// pins are shown; reference-point distances (Acadia, puffin tour, etc.)
// are computed from the first house with coordinates, since the two
// houses in an option are always close together by definition.
export default function GroupMap({ listings, mapConfig }) {
  const houses = listings.filter(hasCoords).map((l) => ({
    lat: l.lat,
    lng: l.lng,
    label: l.title || "House",
  }));

  if (houses.length === 0) return null;

  const seen = new Set();
  const extraMarkers = [];
  listings.forEach((l) => {
    parseExtraMarkers(l.extraMarkers).forEach((m) => {
      const key = `${m.label}|${m.lat}|${m.lng}`;
      if (!seen.has(key)) {
        seen.add(key);
        extraMarkers.push(m);
      }
    });
  });

  return <ListingMap houses={houses} extraMarkers={extraMarkers} mapConfig={mapConfig} />;
}
