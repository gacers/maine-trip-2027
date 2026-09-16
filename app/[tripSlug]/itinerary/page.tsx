import { notFound } from "next/navigation";
import { getTripBySlug, sanitizeTripForClient } from "@/lib/sections";
import { getAdminUser } from "@/lib/auth";
import { isEditorForTrip } from "@/lib/tripEditors";
import ItineraryPage from "@/components/Itinerary";

export const dynamic = "force-dynamic";

export default async function TripItineraryPage({ params }: { params: Promise<{ tripSlug: string }> }) {
  const { tripSlug } = await params;
  const trip = await getTripBySlug(tripSlug);
  if (!trip) notFound();

  const admin = await getAdminUser();
  const isEditor = admin ? false : await isEditorForTrip(trip.id);

  return <ItineraryPage trip={sanitizeTripForClient(trip)} isAdmin={!!admin} isEditor={isEditor} />;
}
