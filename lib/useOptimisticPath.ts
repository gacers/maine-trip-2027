"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

/**
 * Pathname that flips on click, before the App Router finishes the
 * RSC round-trip. Makes sticky nav pills feel instant on force-dynamic
 * routes where the real pathname lags a beat (and a second click feels
 * necessary).
 */
export function useOptimisticPath() {
  const pathname = usePathname();
  const router = useRouter();
  const [pendingPath, setPendingPath] = useState<string | null>(null);

  useEffect(() => {
    setPendingPath(null);
  }, [pathname]);

  const go = useCallback(
    (href: string) => {
      setPendingPath(href);
      router.prefetch(href);
    },
    [router]
  );

  const prefetch = useCallback(
    (href: string) => {
      router.prefetch(href);
    },
    [router]
  );

  return {
    /** Pathname to use for active matching (pending click, else real). */
    path: pendingPath ?? pathname,
    pathname,
    go,
    prefetch,
  };
}
