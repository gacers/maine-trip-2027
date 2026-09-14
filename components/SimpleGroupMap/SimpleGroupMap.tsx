"use client";

import SimplePlaceMap from "@/components/SimplePlaceMap";
import { hasCoords } from "@/lib/listingUtils";
import type { ClientEntry } from "@/lib/types";

export interface SimpleGroupMapProps {
  listings: ClientEntry[];
}

// SimplePlaceMap's counterpart to GroupMap — one shared plain map for a
// 2-item paired option in a non-comparison ("previous") section, no
// driving times/reference points, matching how the full ListingMap
// version is skipped per-entry there too.
export default function SimpleGroupMap({ listings }: SimpleGroupMapProps) {
  const places = listings.filter(hasCoords).map((l) => ({
    lat: l.lat as number,
    lng: l.lng as number,
    label: l.title || "Location",
  }));

  if (places.length === 0) return null;

  return <SimplePlaceMap places={places} />;
}
