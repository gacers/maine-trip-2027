import AccessibleTripsIndex from "@/components/AccessibleTripsIndex";
import { getTripsIndexData, type TripsIndexData } from "@/lib/tripsIndex";
import styles from "./TripsIndexPage.module.css";

// A real Server Component now — this used to be "use client" and fetch
// its own data from /api/trips/index after mount (a network round trip
// to this same server, for data already fully known at request time),
// which is what actually produced the loading skeleton every single
// visit to `/`. app/(home)/page.tsx wraps this in a Suspense boundary
// (fallback: TripsIndexSkeleton) so the shell still streams in
// immediately the same way it visually did before — there's just
// nothing left to wait on client-side once it does. The one piece that
// still can't be known server-side — an anonymous visitor's own invite
// tokens, stored in this browser's localStorage — stays exactly where
// it already was, in AccessibleTripsIndex's own client-side filter.
export default async function TripsIndexPage() {
  let data: TripsIndexData | null = null;
  try {
    data = await getTripsIndexData();
  } catch {
    // Falls through to the error message below.
  }

  if (!data) {
    return (
      <main className={styles["message"]}>
        <p>Could not load trips.</p>
      </main>
    );
  }

  return (
    <div className="page-fade-in">
      <AccessibleTripsIndex
        items={data.items}
        filterByInviteTokens={data.filterByInviteTokens}
        isAdmin={data.isAdmin}
        isSignedIn={data.isSignedIn}
      />
    </div>
  );
}
