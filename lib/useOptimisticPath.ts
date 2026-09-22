"use client";

import { useEffect, useState } from "react";
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

  return {
    /** Pathname to use for active matching (pending click, else real). */
    path: pendingPath ?? pathname,
    pathname,
    /** Mark a nav target as selected immediately; also prefetch RSC. */
    go(href: string) {
      setPendingPath(href);
      router.prefetch(href);
    },
    prefetch(href: string) {
      router.prefetch(href);
    },
  };
}
