import { notFound } from "next/navigation";
import { getTripBySlug, getTripNav } from "@/lib/sections";
import TripSettingsForm from "@/components/admin/TripSettingsForm";

export const dynamic = "force-dynamic";

export default async function TripSettingsPage({ params }: { params: Promise<{ tripSlug: string }> }) {
  const { tripSlug } = await params;
  const trip = await getTripBySlug(tripSlug);
  if (!trip) notFound();

  return <TripSettingsForm trip={trip} nav={await getTripNav(trip.id)} />;
}
