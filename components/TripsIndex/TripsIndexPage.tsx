"use client";

import AccessibleTripsIndex from "@/components/AccessibleTripsIndex";
import SurfacePageSkeleton from "@/components/SurfacePageSkeleton";
import { useTripsIndex } from "@/lib/homeQueries";
import styles from "./TripsIndexPage.module.css";

export default function TripsIndexPage() {
  const { data, isPending, isError } = useTripsIndex();

  if (isPending) {
    return (
      <main className={styles["root"]}>
        <SurfacePageSkeleton cards={3} />
      </main>
    );
  }

  if (isError || !data) {
    return (
      <main className={styles["message"]}>
        <p>Could not load trips.</p>
      </main>
    );
  }

  return (
    <AccessibleTripsIndex
      items={data.items}
      filterByInviteTokens={data.filterByInviteTokens}
      isAdmin={data.isAdmin}
      isSignedIn={data.isSignedIn}
    />
  );
}
