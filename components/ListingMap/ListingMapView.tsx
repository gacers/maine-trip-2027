"use client";

import type { UseListingMapResult } from "./useListingMap";
import styles from "./ListingMap.module.css";

export type ListingMapViewProps = UseListingMapResult;

// The map canvas, its key (legend), and a plain "Open in Google Maps"
// link — everything useListingMap's caller needs to actually SEE the
// map. Split out from Closest Town/Driving Times (see
// ListingMapDetails) so EntryCard can render those as their own card
// section instead of bundled into this one; ListingMap's own default
// export still renders both together for callers (GroupMap) that want
// the original all-in-one block.
export default function ListingMapView({
  mapDivRef,
  status,
  errorMsg,
  houses,
  houseColor,
  destinations,
  liveMapUrl,
}: ListingMapViewProps) {
  return (
    <div className={styles.wrapper}>
      {status === "error" ? (
        <p className={styles.errorBox}>
          Couldn&apos;t load the map ({errorMsg}). Check that NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is set.
        </p>
      ) : (
        <div ref={mapDivRef} className={styles.mapCanvas} />
      )}

      <ul className={styles.legend}>
        {houses.map((h) => (
          <li key={h.label} className={styles.legendItem}>
            <span className={styles.legendDot} style={{ background: houseColor }} />
            {h.label}
          </li>
        ))}
        {destinations.map((dest) => (
          <li key={dest.label} className={styles.legendItem}>
            <span className={styles.legendDot} style={{ background: dest.color }} />
            {dest.label}
          </li>
        ))}
      </ul>

      <a href={liveMapUrl} target="_blank" rel="noopener noreferrer" className={styles.link}>
        Open in Google Maps
      </a>
    </div>
  );
}
