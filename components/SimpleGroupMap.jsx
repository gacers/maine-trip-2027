"use client";

import SimplePlaceMap from "./SimplePlaceMap";
import { hasCoords } from "@/lib/listingUtils";

// SimplePlaceMap's counterpart to GroupMap — one shared plain map for a
// 2-item paired option in a non-comparison ("previous") section, no
// driving times/reference points, matching how the full ListingMap
// version is skipped per-entry there too.
export default function SimpleGroupMap({ listings }) {
  const places = listings.filter(hasCoords).map((l) => ({
    lat: l.lat,
    lng: l.lng,
    label: l.title || "Location",
  }));

  if (places.length === 0) return null;

  return <SimplePlaceMap places={places} />;
}
