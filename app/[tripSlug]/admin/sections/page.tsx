import { notFound } from "next/navigation";
import { getTripBySlug, getTripNav } from "@/lib/sections";
import SectionsAdmin from "@/components/admin/SectionsAdmin";

export const dynamic = "force-dynamic";

export default async function SectionsAdminPage({ params }: { params: Promise<{ tripSlug: string }> }) {
  const { tripSlug } = await params;
  const trip = await getTripBySlug(tripSlug);
  if (!trip) notFound();
  const nav = await getTripNav(trip.id);

  return <SectionsAdmin trip={trip} nav={nav} />;
}
