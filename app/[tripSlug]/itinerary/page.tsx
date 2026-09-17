import { notFound } from "next/navigation";
import { getTripBySlug, sanitizeTripForClient } from "@/lib/sections";
import { getAdminUser } from "@/lib/auth";
import ItineraryPage from "@/components/Itinerary";

export const dynamic = "force-dynamic";

// Hidden behind admin (see getAdminUser) — not yet opened up to trip
// editors/contributors the way the rest of a trip's content is
// (previously super-admin-only while the feature was still being
// tested privately; moved to plain admin now). A plain 404 rather than
// a redirect to login: this isn't "sign in for access" the way /admin
// is, it's "this doesn't exist" for anyone who isn't an admin, which
// TripNavHeader's own itinerary link being hidden the same way already
// implies — no visible "there's a locked door here" hint to anyone
// else. Every /itinerary API route enforces this same check
// server-side too (see requireAdmin), so this page gate is defense in
// depth, not the only thing stopping a direct request.
export default async function TripItineraryPage({ params }: { params: Promise<{ tripSlug: string }> }) {
  const { tripSlug } = await params;
  const trip = await getTripBySlug(tripSlug);
  if (!trip) notFound();

  const admin = await getAdminUser();
  if (!admin) notFound();

  return <ItineraryPage trip={sanitizeTripForClient(trip)} isAdmin={true} isEditor={false} />;
}
