"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import TripCard from "@/components/TripCard";
import LoginPrompt from "@/components/LoginPrompt";
import LogoutButton from "@/components/LogoutButton";
import CreateLoginPrompt from "@/components/CreateLoginPrompt";
import { listInviteTripSlugs, readInviteToken } from "@/lib/inviteClient";
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
  /** Any signed-in session (admin or permanent-login editor) — drives
   * Logout vs Login in the site header. */
  isSignedIn: boolean;
}

// Client half of the All Trips page — anonymous contributors only see
// trips whose invite token is already stored in this browser; admins
// and signed-in editors get a server-filtered list and skip that step.
export default function AccessibleTripsIndex({
  items,
  filterByInviteTokens,
  isAdmin,
  isSignedIn,
}: AccessibleTripsIndexProps) {
  const [visible, setVisible] = useState<TripListItem[]>(() => (filterByInviteTokens ? [] : items));
  const [ready, setReady] = useState(!filterByInviteTokens);
  const [inviteSlug, setInviteSlug] = useState<string | null>(null);
  const [inviteToken, setInviteToken] = useState<string | null>(null);

  useEffect(() => {
    const slugs = listInviteTripSlugs();
    const first = slugs[0] || null;
    setInviteSlug(first);
    setInviteToken(first ? readInviteToken(first) : null);

    if (!filterByInviteTokens) {
      setVisible(items);
      setReady(true);
      return;
    }
    const slugSet = new Set(slugs);
    setVisible(items.filter((item) => slugSet.has(item.trip.slug)));
    setReady(true);
  }, [items, filterByInviteTokens]);

  const showInviteAuth = !isSignedIn && !!inviteToken && !!inviteSlug;

  return (
    <>
      <header className={styles["site-header"]}>
        <div className={styles["site-header-inner"]}>
          <p className={styles["brand"]}>Country Goth Travel</p>
          <div className={styles["header-actions"]}>
            {isSignedIn ? (
              <LogoutButton />
            ) : showInviteAuth ? (
              <div className={styles["invite-access"]}>
                <div className={styles["invite-access-links"]}>
                  <LoginPrompt
                    hasInviteAccess
                    contributorToken={inviteToken}
                    tripSlug={inviteSlug!}
                  />
                  <CreateLoginPrompt trip={{ slug: inviteSlug! }} contributorToken={inviteToken!} />
                </div>
                <p className={styles["invite-access-hint"]}>(current access via browser cookie)</p>
              </div>
            ) : (
              <LoginPrompt />
            )}
          </div>
        </div>
      </header>

      <main className={styles["root"]}>
        <h1 className={styles["heading"]}>Trips</h1>

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
                    .map(({ trip, dateLabel }) => (
                      <TripCard key={trip.id} trip={trip} dateLabel={dateLabel} />
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
                    .map(({ trip, dateLabel }) => (
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
    </>
  );
}
