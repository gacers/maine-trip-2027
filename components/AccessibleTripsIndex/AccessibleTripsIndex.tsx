"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import TripCard from "@/components/TripCard";
import LoginPrompt from "@/components/LoginPrompt";
import { listInviteTripSlugs } from "@/lib/inviteClient";
import type { PublicTrip } from "@/lib/types";
import styles from "./AccessibleTripsIndex.module.css";

export interface TripListItem {
  trip: Pick<PublicTrip, "id" | "slug" | "name" | "cover_image" | "start_date" | "end_date" | "completed">;
  dateLabel: string | null;
  past: boolean;
}

export interface AccessibleTripsIndexProps {
  /** Already server-filtered for admins/editors; for anonymous visitors
   * this is the full public list, further narrowed client-side by
   * invite tokens in localStorage. */
  items: TripListItem[];
  /** When true, intersect with invite:{slug} keys in this browser. */
  filterByInviteTokens: boolean;
  isAdmin: boolean;
}

// Client half of the All Trips page — anonymous contributors only see
// trips whose invite token is already stored in this browser; admins
// and signed-in editors get a server-filtered list and skip that step.
export default function AccessibleTripsIndex({ items, filterByInviteTokens, isAdmin }: AccessibleTripsIndexProps) {
  const [visible, setVisible] = useState<TripListItem[]>(() => (filterByInviteTokens ? [] : items));
  const [ready, setReady] = useState(!filterByInviteTokens);

  useEffect(() => {
    if (!filterByInviteTokens) {
      setVisible(items);
      setReady(true);
      return;
    }
    const slugs = new Set(listInviteTripSlugs());
    setVisible(items.filter((item) => slugs.has(item.trip.slug)));
    setReady(true);
  }, [items, filterByInviteTokens]);

  if (!ready) {
    return (
      <main className={styles["root"]}>
        <h1 className={styles["heading"]}>Trips</h1>
        <p className={styles["empty-hint"]}>Loading…</p>
      </main>
    );
  }

  const pending = visible.filter((i) => !i.past);
  const past = visible.filter((i) => i.past);

  return (
    <main className={styles["root"]}>
      <h1 className={styles["heading"]}>Trips</h1>

      {visible.length === 0 ? (
        <div className={styles["empty-block"]}>
          <p className={styles["empty-hint"]}>No trips you have access to.</p>
          <p className={styles["empty-hint"]}>
            Open an invite link or sign in with a permanent login to see your trips here.
          </p>
          <div className={styles["login-wrap"]}>
            <LoginPrompt />
          </div>
        </div>
      ) : (
        <>
          {pending.length > 0 && (
            <section className={styles["trip-section"]}>
              <h2 className={styles["section-heading"]}>Pending Trips</h2>
              <div className={styles["trip-grid"]}>
                {pending.map(({ trip, dateLabel }) => (
                  <TripCard key={trip.id} trip={trip} dateLabel={dateLabel} />
                ))}
              </div>
            </section>
          )}

          {past.length > 0 && (
            <section className={styles["trip-section"]}>
              <h2 className={styles["section-heading"]}>Past Trips</h2>
              <div className={styles["trip-grid"]}>
                {past.map(({ trip, dateLabel }) => (
                  <TripCard key={trip.id} trip={trip} dateLabel={dateLabel} />
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {isAdmin && (
        <div className={styles["actions-row"]}>
          <Link href="/trips/new" className={styles["new-trip-button"]}>
            + New trip
          </Link>
          <Link href="/settings" className={styles["settings-link"]}>
            Settings
          </Link>
        </div>
      )}
    </main>
  );
}
