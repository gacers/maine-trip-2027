"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import SiteHeader, { siteHeaderStyles } from "@/components/SiteHeader";
import HomeShell from "@/components/HomeShell";
import HomeShellSkeleton from "./HomeShellSkeleton";
import { useHomeShell } from "@/lib/homeQueries";
import styles from "./HomeShell.module.css";

/** Fetches home chrome once client-side — layout stays static on nav. */
export default function HomeShellBootstrap({ children }: { children: ReactNode }) {
  const { data, isPending, isError } = useHomeShell();

  if (isError) {
    return (
      <main style={{ maxWidth: "var(--content-max-width)", margin: "0 auto", padding: "3rem 1rem", textAlign: "center" }}>
        <p style={{ color: "var(--color-zinc-500)" }}>Could not load site chrome.</p>
      </main>
    );
  }

  // Shell data still loading — real header (doesn't depend on it) plus
  // a stack-nav-shaped placeholder underneath, so the page's own
  // content doesn't jump down once the real one (every admin visit has
  // one — see HomeShellSkeleton's own comment) pops in a beat later.
  if (isPending || !data) {
    return (
      <>
        <div className={styles["sticky-chrome"]}>
          <SiteHeader
            brand={
              <Link href="/" className={siteHeaderStyles["brand-title"]}>
                Country Goth Travel
              </Link>
            }
          />
          <HomeShellSkeleton />
        </div>
        {children}
      </>
    );
  }

  return (
    <HomeShell
      isAdmin={data.isAdmin}
      isSignedIn={data.isSignedIn}
      placesCategoryTabs={data.placesCategoryTabs}
      futureInterestsCategoryTabs={data.futureInterestsCategoryTabs}
    >
      {children}
    </HomeShell>
  );
}
