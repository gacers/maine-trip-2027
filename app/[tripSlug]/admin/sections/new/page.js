import { getTripBySlug, getTripNav } from "@/lib/sections";
import SectionForm from "@/components/admin/SectionForm";

export const dynamic = "force-dynamic";

export default async function NewSectionPage({ params }) {
  const { tripSlug } = await params;
  const trip = await getTripBySlug(tripSlug);
  const nav = await getTripNav(trip.id);
  const navGroups = nav.map(({ sections, ...g }) => g);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-bold text-zinc-900">New section</h1>
      <SectionForm trip={trip} navGroups={navGroups} />
    </div>
  );
}
