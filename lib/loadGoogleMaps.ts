"use client";

import type { GoogleMapsApi } from "@/lib/useGoogleMaps";

let loadingPromise: Promise<GoogleMapsApi | null> | null = null;

// Loads the Google Maps JavaScript API (with the Places library) at
// most once per page, regardless of how many map components mount.
// Geocoding (address <-> coordinates) used to live here too, calling
// google.maps.Geocoder directly, client-side, uncached — see
// lib/geocodeClient.ts (and the server-side lib/geocodeCache.ts behind
// it) for where that moved to.
export function loadGoogleMaps(): Promise<GoogleMapsApi | null> {
  if (typeof window === "undefined") return Promise.resolve(null);
  if (window.google && window.google.maps) return Promise.resolve(window.google);
  if (loadingPromise) return loadingPromise;

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    return Promise.reject(new Error("NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is not set"));
  }

  loadingPromise = new Promise((resolve, reject) => {
    const callbackName = "__gmapsInit";
    window[callbackName] = () => {
      resolve(window.google);
      delete window[callbackName];
    };
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&callback=${callbackName}`;
    script.async = true;
    script.onerror = () => reject(new Error("Failed to load Google Maps JS API"));
    document.head.appendChild(script);
  });

  return loadingPromise;
}
