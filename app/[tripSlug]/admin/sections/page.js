import { getTripBySlug, getTripNav } from "@/lib/sections";
import SectionsAdmin from "@/components/admin/SectionsAdmin";

export const dynamic = "force-dynamic";

export default async function SectionsAdminPage({ params }) {
  const { tripSlug } = await params;
  const trip = await getTripBySlug(tripSlug);
  const nav = await getTripNav(trip.id);

  return <SectionsAdmin trip={trip} nav={nav} />;
}
