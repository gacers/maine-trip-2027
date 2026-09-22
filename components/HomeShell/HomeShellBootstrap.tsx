"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import SiteHeader, { siteHeaderStyles } from "@/components/SiteHeader";
import HomeShell from "@/components/HomeShell";
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

  // Shell data still loading — show real header, let the page own its skeleton.
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
