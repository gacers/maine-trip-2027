"use client";

import { useEffect, useRef, useState } from "react";
import { loadGoogleMaps } from "@/lib/loadGoogleMaps";

// A map at the top of a collection page showing one pin per render unit
// (a paired 2-item option collapses to a single pin). Clicking a pin
// scrolls the matching section into view.
export default function OverviewMap({ pins }) {
  const mapDivRef = useRef(null);
  const [status, setStatus] = useState("loading"); // loading | ready | error | empty
  const [errorMsg, setErrorMsg] = useState("");

  const validPins = pins.filter(
    (p) => p.lat !== null && p.lat !== "" && p.lat !== undefined && p.lng !== null && p.lng !== "" && p.lng !== undefined
  );
  const pinsKey = validPins.map((p) => `${p.anchor}:${p.lat},${p.lng}`).join("|");

  useEffect(() => {
    if (validPins.length === 0) return;
    let cancelled = false;

    loadGoogleMaps()
      .then((google) => {
        if (cancelled || !mapDivRef.current) return;

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
              el.scrollIntoView({ behavior: "smooth", block: "start" });
              if (typeof window !== "undefined" && window.history) {
                window.history.replaceState(null, "", `#${p.anchor}`);
              }
            }
          });
          bounds.extend({ lat: p.lat, lng: p.lng });
        });

        map.fitBounds(bounds);
        google.maps.event.addListenerOnce(map, "bounds_changed", () => {
          if (map.getZoom() > 12) map.setZoom(12);
        });

        setStatus("ready");
      })
      .catch((err) => {
        if (!cancelled) {
          setStatus("error");
          setErrorMsg(err.message);
        }
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pinsKey]);

  if (validPins.length === 0) return null;

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 sm:p-5 shadow-sm flex flex-col gap-2">
      <h2 className="text-sm uppercase tracking-wide text-zinc-500 font-medium">All Locations</h2>
      {status === "error" ? (
        <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
          Couldn&apos;t load the map ({errorMsg}).
        </p>
      ) : (
        <div ref={mapDivRef} className="w-full h-64 sm:h-80 rounded-lg bg-zinc-100" />
      )}
      <p className="text-xs text-zinc-500">Click a pin to jump to that listing.</p>
    </div>
  );
}
