"use client";

import { useEffect, useRef } from "react";
import { useGoogleMaps } from "@/lib/useGoogleMaps";
import type { OverviewPin } from "@/lib/types";
import styles from "./OverviewMap.module.css";

export interface OverviewMapProps {
  pins: OverviewPin[];
}

// A map at the top of a collection page showing one pin per render unit
// (a paired 2-item option collapses to a single pin). Clicking a pin
// scrolls the matching section into view.
export default function OverviewMap({ pins }: OverviewMapProps) {
  const mapDivRef = useRef<HTMLDivElement>(null);
  const { google, status, errorMsg } = useGoogleMaps();

  const validPins = pins.filter(
    (p) =>
      p.lat !== null &&
      (p.lat as unknown) !== "" &&
      p.lat !== undefined &&
      p.lng !== null &&
      (p.lng as unknown) !== "" &&
      p.lng !== undefined
  );
  const pinsKey = validPins.map((p) => `${p.anchor}:${p.lat},${p.lng}`).join("|");

  useEffect(() => {
    if (!google || !mapDivRef.current || validPins.length === 0) return;

    const map = new google.maps.Map(mapDivRef.current, {
      zoom: 8,
      center: { lat: validPins[0].lat, lng: validPins[0].lng },
    });

    const bounds = new google.maps.LatLngBounds();

    validPins.forEach((p) => {
      const marker = new google.maps.Marker({
        position: { lat: p.lat, lng: p.lng },
        map,
        title: p.label,
      });
      marker.addListener("click", () => {
        const el = document.getElementById(p.anchor);
        if (el) {
          // scroll-margin-top on the card/group itself (see EntryCard's
          // and ListingSection's own CSS) keeps this from landing half
          // behind TripNavHeader's sticky bar.
          el.scrollIntoView({ behavior: "smooth", block: "start" });
          if (typeof window !== "undefined" && window.history) {
            window.history.replaceState(null, "", `#${p.anchor}`);
          }
          // A plain global class (not a CSS Module one) — this targets
          // whatever element the anchor id is actually on, in an
          // entirely different component than this map.
          el.classList.remove("pin-jump-highlight");
          // Force a reflow so re-adding the class restarts the
          // animation even if the same pin is clicked again mid-pulse.
          void el.offsetWidth;
          el.classList.add("pin-jump-highlight");
          window.setTimeout(() => el.classList.remove("pin-jump-highlight"), 5000);
        }
      });
      bounds.extend({ lat: p.lat, lng: p.lng });
    });

    map.fitBounds(bounds);
    google.maps.event.addListenerOnce(map, "bounds_changed", () => {
      if (map.getZoom() > 12) map.setZoom(12);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [google, pinsKey]);

  if (validPins.length === 0) return null;

  return (
    <div className={styles["root"]}>
      <h2 className={styles["heading"]}>All Locations</h2>
      {status === "error" ? (
        <p className={styles["error-box"]}>Couldn&apos;t load the map ({errorMsg}).</p>
      ) : (
        <div ref={mapDivRef} className={styles["map-canvas"]} />
      )}
      <p className={styles["hint"]}>Click a pin to jump to that listing.</p>
    </div>
  );
}
