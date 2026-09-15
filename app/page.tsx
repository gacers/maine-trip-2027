import Link from "next/link";
import { getAllTrips } from "@/lib/sections";
import TripCard from "@/components/TripCard";
import type { Trip } from "@/lib/types";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

// A real date range once a trip has an end_date set (see
// TripSettingsForm/NewTripForm), not just "July 2027" for the whole
// thing — collapses shared month/year rather than repeating them
// ("July 1–8, 2027", "Dec 28, 2027 – Jan 3, 2028"). Falls back to the
// old month/year-only label when there's no end date yet.
function tripDateLabel(startDate: string | null | undefined, endDate: string | null | undefined): string | null {
  if (!startDate) return null;
  const start = new Date(startDate);
  if (!endDate) {
    return start.toLocaleDateString(undefined, { year: "numeric", month: "long" });
  }
  const end = new Date(endDate);
  const sameYear = start.getFullYear() === end.getFullYear();
  const sameMonth = sameYear && start.getMonth() === end.getMonth();
  if (sameMonth) {
    const month = start.toLocaleDateString(undefined, { month: "long" });
    return `${month} ${start.getDate()}–${end.getDate()}, ${start.getFullYear()}`;
  }
  const startLabel = start.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: sameYear ? undefined : "numeric",
  });
  const endLabel = end.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  return `${startLabel} – ${endLabel}`;
}

// Past = explicitly marked Completed (see TripSettingsForm) OR its own
// end date (or start date, if that's all it has) has already gone by.
// Everything else — no dates yet, or dates still ahead — is Pending,
// the first/default list.
function isPastTrip(trip: Trip, todayIso: string): boolean {
  if (trip.completed) return true;
  const referenceDate = trip.end_date || trip.start_date;
  return !!referenceDate && referenceDate < todayIso;
}

// The site's home: every trip split into Pending (still ahead, or
// undated) and Past (completed, or its own dates already gone by),
// each a 3-across grid of full-bleed photo cards. Replaces the old
// single flat list — Pending trips are what you're actually planning
// right now, so they come first.
export default async function TripsIndexPage() {
  const trips = await getAllTrips();
  const todayIso = new Date().toISOString().slice(0, 10);

  const pending = trips
    .filter((t) => !isPastTrip(t, todayIso))
    .sort((a, b) => (a.start_date || "9999").localeCompare(b.start_date || "9999"));
  const past = trips
    .filter((t) => isPastTrip(t, todayIso))
    .sort((a, b) => (b.end_date || b.start_date || "").localeCompare(a.end_date || a.start_date || ""));

  return (
    <main className={styles.main}>
      <h1 className={styles.heading}>Trips</h1>

      {trips.length === 0 ? (
        <p className={styles.emptyHint}>No trips yet.</p>
      ) : (
        <>
          {pending.length > 0 && (
            <section className={styles.tripSection}>
              <h2 className={styles.sectionHeading}>Pending Trips</h2>
              <div className={styles.tripGrid}>
                {pending.map((trip) => (
                  <TripCard key={trip.id} trip={trip} dateLabel={tripDateLabel(trip.start_date, trip.end_date)} />
                ))}
              </div>
            </section>
          )}

          {past.length > 0 && (
            <section className={styles.tripSection}>
              <h2 className={styles.sectionHeading}>Past Trips</h2>
              <div className={styles.tripGrid}>
                {past.map((trip) => (
                  <TripCard key={trip.id} trip={trip} dateLabel={tripDateLabel(trip.start_date, trip.end_date)} />
                ))}
              </div>
            </section>
          )}
        </>
      )}

      <div className={styles.actionsRow}>
        <Link href="/trips/new" className={styles.newTripButton}>
          + New trip
        </Link>
        <Link href="/settings" className={styles.settingsLink}>
          Settings
        </Link>
      </div>
    </main>
  );
}
