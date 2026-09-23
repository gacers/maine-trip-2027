"use client";

import { useEffect, useRef } from "react";
import { useGoogleMaps } from "@/lib/useGoogleMaps";
import { pinIcon } from "@/lib/mapIcons";
import type { LatLngLabel } from "@/lib/types";
import styles from "./SimplePlaceMap.module.css";

export interface SimplePlaceMapPoint extends LatLngLabel {
  /** Set for this entry's own "Extra map points" (kayak put-in/take-out,
   * a trailhead, ...) — drawn as a colored pin, same as ListingMap's own
   * destination pins, so they read as distinct from the entry's own
   * plain default-pin location. Omitted (the common case: just this
   * entry's own spot, nothing extra) keeps the plain default pin. */
  color?: string;
}

export interface SimplePlaceMapProps {
  places: SimplePlaceMapPoint[];
}

// A plain marker map for an entry that isn't being actively compared
// against other options (a "previous"/already-decided section — see
// SectionPage's comparisonMode) — just the pin(s) and a link to open
// the real Google Maps app/site, no Directions API calls for driving
// times and no reverse-geocoded "Closest Town" the way ListingMap does
// for a still-deciding section. `places` is one or more {lat, lng,
// label}, matching ListingMap's `houses` shape so a group of 2 renders
// on one shared map the same way GroupMap does for the full version —
// also how an entry's own "Extra map points" (see EntryEditForm) show
// up here: LocationSection appends them to this same list rather than
// this component needing any special-case handling of its own.
export default function SimplePlaceMap({ places }: SimplePlaceMapProps) {
  const mapDivRef = useRef<HTMLDivElement>(null);
  const { google, status, errorMsg } = useGoogleMaps();
  const key = places.map((p) => `${p.lat},${p.lng}`).join("|");

  useEffect(() => {
    if (!google || !mapDivRef.current) return;
    const map = new google.maps.Map(mapDivRef.current, { zoom: 13, center: places[0] });
    const bounds = new google.maps.LatLngBounds();
    places.forEach((p) => {
      new google.maps.Marker({
        position: p,
        map,
        title: p.label,
        icon: p.color ? pinIcon(google, p.color) : undefined,
      });
      bounds.extend(p);
    });
    if (places.length > 1) map.fitBounds(bounds);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [google, key]);

  function mapsUrl(p: LatLngLabel): string {
    return `https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lng}`;
  }

  return (
    <div className={styles["root"]}>
      {status === "error" ? (
        <p className={styles["error-box"]}>Couldn&apos;t load the map ({errorMsg}).</p>
      ) : (
        <div ref={mapDivRef} className={styles["map-canvas"]} />
      )}

      {/* A solo place just needs the one link — a list (and repeating
          its own label, already shown as this card's title) is only
          worth it once there's more than one to tell apart. */}
      {places.length === 1 ? (
        <a href={mapsUrl(places[0])} target="_blank" rel="noopener noreferrer" className={styles["place-link"]}>
          Open in Google Maps
        </a>
      ) : (
        <ul className={styles["place-list"]}>
          {places.map((p, i) => (
            <li key={i}>
              <a href={mapsUrl(p)} target="_blank" rel="noopener noreferrer" className={styles["place-link"]}>
                {p.label} — Open in Google Maps
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
