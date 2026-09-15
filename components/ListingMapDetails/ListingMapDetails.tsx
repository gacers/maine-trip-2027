"use client";

import BulletList from "@/components/BulletList";
import type { UseListingMapResult } from "@/components/ListingMap/useListingMap";
import styles from "./ListingMapDetails.module.css";

export type ListingMapDetailsProps = UseListingMapResult;

// Closest Town + Driving Times — split out of ListingMap's own output
// (see ListingMapView) so EntryCard can render this as its own card
// section instead of bundled into the map's. Takes the exact same
// useListingMap() result EntryCard already has for ListingMapView, so
// there's still only one Google Maps instance/Directions calls behind
// both pieces. Renders nothing if there's genuinely nothing to show
// (no resolved closest town, and reference points/driving times are
// off for this section).
export default function ListingMapDetails({
  closestTown,
  showReferencePoints,
  originInfo,
  originLabel,
  routeInfo,
  destinations,
}: ListingMapDetailsProps) {
  if (!closestTown && !showReferencePoints) return null;

  return (
    <div className={styles["root"]}>
      {closestTown && (
        <div>
          <h3 className={styles["heading"]}>Closest Town</h3>
          <a
            href={`https://www.google.com/search?q=${encodeURIComponent(closestTown.searchQuery)}`}
            target="_blank"
            rel="noopener noreferrer"
            className={styles["link"]}
          >
            {closestTown.name}
          </a>
        </div>
      )}

      {showReferencePoints && (
        <div>
          <h3 className={styles["heading"]}>Driving Times</h3>
          <BulletList>
            {originInfo && (
              <li>
                <a href={originInfo.url} target="_blank" rel="noopener noreferrer" className={styles["link"]}>
                  {originLabel} &rarr; house: {originInfo.text}
                </a>
              </li>
            )}
            {destinations.map((dest) => {
              const info = routeInfo[dest.label];
              return (
                <li key={dest.label}>
                  {info ? (
                    <a href={info.url} target="_blank" rel="noopener noreferrer" className={styles["link"]}>
                      House &rarr; {dest.label}: {info.text}
                    </a>
                  ) : (
                    <span className={styles["loading-row"]}>House &rarr; {dest.label}: loading...</span>
                  )}
                </li>
              );
            })}
          </BulletList>
        </div>
      )}
    </div>
  );
}
