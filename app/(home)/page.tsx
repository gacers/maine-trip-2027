import { Suspense } from "react";
import TripsIndexPage from "@/components/TripsIndex";
import TripsIndexSkeleton from "@/components/TripsIndex/TripsIndexSkeleton";

export const dynamic = "force-dynamic";

// TripsIndexPage is now a real async Server Component (see its own
// comment) — this Suspense boundary is what keeps the page streaming
// immediately with the exact same skeleton it always showed, instead
// of the whole response blocking on getTripsIndexData().
export default function TripsIndexRoute() {
  return (
    <Suspense fallback={<TripsIndexSkeleton />}>
      <TripsIndexPage />
    </Suspense>
  );
}
