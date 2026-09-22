"use client";

import type { ReactNode } from "react";
import HomeShell from "@/components/HomeShell";
import SurfacePageSkeleton from "@/components/SurfacePageSkeleton";
import { useHomeShell } from "@/lib/homeQueries";
import styles from "./HomeShell.module.css";

/** Fetches home chrome once client-side — layout stays static on nav. */
export default function HomeShellBootstrap({ children }: { children: ReactNode }) {
  const { data, isPending, isError } = useHomeShell();

  if (isPending) {
    return (
      <>
        <div className={styles["sticky-chrome"]} aria-hidden />
        <SurfacePageSkeleton cards={3} />
      </>
    );
  }

  if (isError || !data) {
    return (
      <main style={{ maxWidth: "40rem", margin: "0 auto", padding: "3rem 1rem", textAlign: "center" }}>
        <p style={{ color: "var(--color-zinc-500)" }}>Could not load site chrome.</p>
      </main>
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
