import { notFound } from "next/navigation";
import { getTripBySlug, getTripNav } from "@/lib/sections";
import TripSettingsForm from "@/components/admin/TripSettingsForm";
import ArchiveUnvisitedButton from "@/components/ArchiveUnvisitedButton";

export const dynamic = "force-dynamic";

export default async function TripSettingsPage({ params }: { params: Promise<{ tripSlug: string }> }) {
  const { tripSlug } = await params;
  const trip = await getTripBySlug(tripSlug);
  if (!trip) notFound();

  return (
    <>
      <TripSettingsForm trip={trip} />
      {/* Lives here (not the nav bar — see TripNavHeader's own comment
          on why) right by the Completed checkbox that gates it. */}
      {trip.completed && <ArchiveUnvisitedButton trip={trip} nav={await getTripNav(trip.id)} />}
    </>
  );
}
