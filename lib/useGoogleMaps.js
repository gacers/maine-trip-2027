"use client";

import { useEffect, useState } from "react";
import { loadGoogleMaps } from "@/lib/loadGoogleMaps";

// Shared "load the Maps JS SDK" boilerplate: loadGoogleMaps() itself is
// already cached/idempotent, but every map component still needs its own
// loading/ready/error state plus the unmount guard around it. Used by
// both ListingMap and OverviewMap so that plumbing exists in one place;
// each component's own effect still builds its own map/markers once
// `google` is available, since that part isn't shared.
export function useGoogleMaps() {
  const [google, setGoogle] = useState(null);
  const [status, setStatus] = useState("loading"); // loading | ready | error
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    let cancelled = false;

    loadGoogleMaps()
      .then((g) => {
        if (cancelled) return;
        setGoogle(g);
        setStatus("ready");
      })
      .catch((err) => {
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
