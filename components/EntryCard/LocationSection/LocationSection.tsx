import { ListingMapView, type useListingMap } from "@/components/ListingMap";
import ListingMapDetails from "@/components/ListingMapDetails";
import SimplePlaceMap from "@/components/SimplePlaceMap";
import type { MapReferencePoint } from "@/lib/types";
import styles from "./LocationSection.module.css";

export interface LocationSectionProps {
  entry: { lat: number | null; lng: number | null; title: string | null };
  comparisonMode: boolean;
  listingMapData: ReturnType<typeof useListingMap>;
  /** This entry's own "Extra map points" (see EntryEditForm) — a kayak
   * trip's put-in/take-out, a trailhead, etc. In comparisonMode these
   * already ride along inside listingMapData.destinations (see
   * useListingMap); passed separately here too since the plain
   * SimplePlaceMap branch below has no other way to see them. */
  extraMarkers: MapReferencePoint[];
}

// The map itself, plus — its own section, not bundled into the map's —
// Closest Town/Driving Times underneath when there's any to show.
// Self-gates on that second part; the parent still owns the outer
// check for whether to render this at all (no house/coords, editing,
// or the section's own showMap toggle being off).
export default function LocationSection({ entry, comparisonMode, listingMapData, extraMarkers }: LocationSectionProps) {
  return (
    <>
      <div className={styles["map"]}>
        {comparisonMode ? (
          <ListingMapView {...listingMapData} />
        ) : (
          <SimplePlaceMap
            places={[
              { lat: entry.lat as number, lng: entry.lng as number, label: entry.title || "Location" },
              ...extraMarkers,
            ]}
          />
        )}
      </div>
      {comparisonMode && (listingMapData.closestTown || listingMapData.showReferencePoints) && (
        <div className={styles["details"]}>
          <ListingMapDetails {...listingMapData} />
        </div>
      )}
    </>
  );
}
