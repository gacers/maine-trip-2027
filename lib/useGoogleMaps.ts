"use client";

import { useEffect, useState } from "react";
import { loadGoogleMaps } from "@/lib/loadGoogleMaps";

// The Google Maps JS API's own namespace — no @types/google.maps package
// installed (a large surface this app only touches a handful of methods
// on), so every map component treats it as `any` past this one point,
// rather than typing Google's entire API just to satisfy the compiler.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type GoogleMapsApi = any;

export type GoogleMapsStatus = "loading" | "ready" | "error";

export interface UseGoogleMapsResult {
  google: GoogleMapsApi | null;
  status: GoogleMapsStatus;
  errorMsg: string;
}

// Shared "load the Maps JS SDK" boilerplate: loadGoogleMaps() itself is
// already cached/idempotent, but every map component still needs its own
// loading/ready/error state plus the unmount guard around it. Used by
// both ListingMap and OverviewMap so that plumbing exists in one place;
// each component's own effect still builds its own map/markers once
// `google` is available, since that part isn't shared.
export function useGoogleMaps(): UseGoogleMapsResult {
  const [google, setGoogle] = useState<GoogleMapsApi | null>(null);
  const [status, setStatus] = useState<GoogleMapsStatus>("loading");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    let cancelled = false;

    loadGoogleMaps()
      .then((g: GoogleMapsApi) => {
        if (cancelled) return;
        setGoogle(g);
        setStatus("ready");
      })
      .catch((err: Error) => {
        if (cancelled) return;
        setStatus("error");
        setErrorMsg(err.message);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { google, status, errorMsg };
}
