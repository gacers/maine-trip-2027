"use client";

import { useListingMap, type UseListingMapArgs } from "./useListingMap";
import ListingMapView from "./ListingMapView";
import ListingMapDetails from "@/components/ListingMapDetails";
import styles from "./ListingMap.module.css";

export type ListingMapProps = UseListingMapArgs;

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
// The all-in-one, backward-compatible entry point — GroupMap wants the
// map and Closest Town/Driving Times bundled together as before. A
// caller that wants those as two separate pieces (EntryCard, so it can
// give them their own card sections) can call useListingMap() itself
// and render ListingMapView/ListingMapDetails independently instead.
export default function ListingMap(args: ListingMapProps) {
  const data = useListingMap(args);
  return (
    <div className={styles.allInOne}>
      <ListingMapView {...data} />
      <ListingMapDetails {...data} />
    </div>
  );
}
