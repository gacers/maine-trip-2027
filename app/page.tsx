import Link from "next/link";
import { getAllTrips } from "@/lib/sections";
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

// The site's new home: a list of every trip, newest first, each linking
// to its own /{tripSlug}. Replaces the old single-trip home page (its
// content now lives at /maine-2027).
export default async function TripsIndexPage() {
  const trips = await getAllTrips();

  return (
    <main className={styles.main}>
      <h1 className={styles.heading}>Trips</h1>

      {trips.length === 0 ? (
        <p className={styles.emptyHint}>No trips yet.</p>
      ) : (
        <ul className={styles.tripList}>
          {trips.map((trip) => (
            <li key={trip.id}>
              <Link href={`/${trip.slug}`} className={styles.tripLink}>
                <div className={styles.tripName}>{trip.name}</div>
                {trip.subtitle && <div className={styles.tripSubtitle}>{trip.subtitle}</div>}
                {tripDateLabel(trip.start_date, trip.end_date) && (
                  <div className={styles.tripDate}>{tripDateLabel(trip.start_date, trip.end_date)}</div>
                )}
              </Link>
            </li>
          ))}
        </ul>
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
