"use client";

import { useListingMap, ListingMapView } from "@/components/ListingMap";
import ListingMapDetails from "@/components/ListingMapDetails";
import { parseExtraMarkers, hasCoords } from "@/lib/listingUtils";
import type { ClientEntry, MapConfig, MapReferencePoint } from "@/lib/types";
import styles from "./GroupMap.module.css";

export interface GroupMapProps {
  listings: ClientEntry[];
  mapConfig?: MapConfig;
  tripSlug: string;
}

// One shared map + one shared set of driving times for a 2-house-option
// group, instead of duplicating a full map under each card. Both houses'
// pins are shown; reference-point distances (Acadia, puffin tour, etc.)
// are computed from the first house with coordinates, since the two
// houses in an option are always close together by definition. Renders
// its own two sections (map+key, then Closest Town/Driving Times) —
// same split as EntryCard's solo card — rather than one bundled block,
// so SectionPage doesn't wrap this in its own section div the way it
// does for SimpleGroupMap.
export default function GroupMap({ listings, mapConfig, tripSlug }: GroupMapProps) {
  const houses = listings.filter(hasCoords).map((l) => ({
    lat: l.lat as number,
    lng: l.lng as number,
    label: l.title || "House",
  }));

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

  // Called unconditionally (Rules of Hooks) — `enabled` no-ops it
  // entirely once there's nothing to plot. Groups only ever exist for
  // Possible Houses (pairing is a Houses-only feature), so reference
  // points/Closest Town/Driving Times always apply here, unlike
  // EntryCard's solo card, which has to check per-section.
  const listingMapData = useListingMap({
    houses,
    extraMarkers,
    mapConfig,
    showReferencePoints: true,
    enabled: houses.length > 0,
    tripSlug,
  });

  if (houses.length === 0) return null;

  return (
    <>
      <div className={styles["section"]}>
        <ListingMapView {...listingMapData} />
      </div>
      {(listingMapData.closestTown || listingMapData.showReferencePoints) && (
        <div className={styles["section"]}>
          <ListingMapDetails {...listingMapData} />
        </div>
      )}
    </>
  );
}
