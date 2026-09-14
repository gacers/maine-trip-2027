"use client";

import ListingMap from "@/components/ListingMap";
import { parseExtraMarkers, hasCoords } from "@/lib/listingUtils";
import type { ClientEntry, MapConfig, MapReferencePoint } from "@/lib/types";

export interface GroupMapProps {
  listings: ClientEntry[];
  mapConfig?: MapConfig;
}

// One shared map + one shared set of driving times for a 2-house-option
// group, instead of duplicating a full map under each card. Both houses'
// pins are shown; reference-point distances (Acadia, puffin tour, etc.)
// are computed from the first house with coordinates, since the two
// houses in an option are always close together by definition.
export default function GroupMap({ listings, mapConfig }: GroupMapProps) {
  const houses = listings.filter(hasCoords).map((l) => ({
    lat: l.lat as number,
    lng: l.lng as number,
    label: l.title || "House",
  }));

  if (houses.length === 0) return null;

  const seen = new Set<string>();
  const extraMarkers: MapReferencePoint[] = [];
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
