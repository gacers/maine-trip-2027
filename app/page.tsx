import Link from "next/link";
import { getAllTrips } from "@/lib/sections";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

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
                {trip.start_date && (
                  <div className={styles.tripDate}>
                    {new Date(trip.start_date).toLocaleDateString(undefined, { year: "numeric", month: "long" })}
                  </div>
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
