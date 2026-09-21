"use client";

import { useEffect, useState } from "react";
import TripCard from "@/components/TripCard";
import { listInviteTripSlugs } from "@/lib/inviteClient";
import type { PublicTrip } from "@/lib/types";
import styles from "./AccessibleTripsIndex.module.css";

export interface TripListItem {
  trip: Pick<PublicTrip, "id" | "slug" | "name" | "cover_image" | "start_date" | "end_date" | "completed">;
  dateLabel: string | null;
  past: boolean;
  /** Direct path into the trip (first enabled section when available). */
  href: string;
}

export interface AccessibleTripsIndexProps {
  /** Already server-filtered for admins/editors; for anonymous visitors
   * this is the full public list, further narrowed client-side by
   * invite tokens in localStorage. */
  items: TripListItem[];
  /** When true, intersect with invite:{slug} keys in this browser. */
  filterByInviteTokens: boolean;
  isAdmin: boolean;
  /** Any signed-in session (admin or permanent-login editor) — drives
   * Logout vs Login in the site header (now owned by HomeShell). */
  isSignedIn: boolean;
}

// Client half of the All Trips tab — anonymous contributors only see
// trips whose invite token is already stored in this browser; admins
// and signed-in editors get a server-filtered list and skip that step.
// Header + stack nav live in HomeShell / (home) layout.
export default function AccessibleTripsIndex({ items, filterByInviteTokens }: AccessibleTripsIndexProps) {
  const [visible, setVisible] = useState<TripListItem[]>(() => (filterByInviteTokens ? [] : items));
  const [ready, setReady] = useState(!filterByInviteTokens);

  useEffect(() => {
    if (!filterByInviteTokens) {
      setVisible(items);
      setReady(true);
      return;
    }
    const slugSet = new Set(listInviteTripSlugs());
    setVisible(items.filter((item) => slugSet.has(item.trip.slug)));
    setReady(true);
  }, [items, filterByInviteTokens]);

  return (
    <main className={styles["root"]}>
      {!ready ? (
        <p className={styles["empty-hint"]}>Loading…</p>
      ) : visible.length === 0 ? (
        <div className={styles["empty-block"]}>
          <p className={styles["empty-hint"]}>No trips you have access to.</p>
          <p className={styles["empty-hint"]}>
            Open an invite link or sign in with a permanent login to see your trips here.
          </p>
        </div>
      ) : (
        <>
          {visible.filter((i) => !i.past).length > 0 && (
            <section className={styles["trip-section"]}>
              <h2 className={styles["section-heading"]}>Pending Trips</h2>
              <div className={styles["trip-grid"]}>
                {visible
                  .filter((i) => !i.past)
                  .map(({ trip, dateLabel, href }) => (
                    <TripCard key={trip.id} trip={trip} dateLabel={dateLabel} href={href} />
                  ))}
              </div>
            </section>
          )}

          {visible.filter((i) => i.past).length > 0 && (
            <section className={styles["trip-section"]}>
              <h2 className={styles["section-heading"]}>Past Trips</h2>
              <div className={styles["trip-grid"]}>
                {visible
                  .filter((i) => i.past)
                  .map(({ trip, dateLabel, href }) => (
                    <TripCard key={trip.id} trip={trip} dateLabel={dateLabel} href={href} />
                  ))}
              </div>
            </section>
          )}
        </>
      )}
    </main>
  );
}
