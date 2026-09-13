import { notFound } from "next/navigation";
import { getTripBySlug, getSectionBySlug, getTripNav } from "@/lib/sections";
import SectionForm from "@/components/admin/SectionForm";

export const dynamic = "force-dynamic";

export default async function EditSectionPage({ params }) {
  const { tripSlug, sectionSlug } = await params;
  const trip = await getTripBySlug(tripSlug);
  const section = await getSectionBySlug(trip.id, sectionSlug);
  if (!section) notFound();
  const nav = await getTripNav(trip.id);
  const navGroups = nav.map(({ sections, ...g }) => g);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-bold text-zinc-900">Edit {section.label}</h1>
      <SectionForm trip={trip} navGroups={navGroups} section={section} />
    </div>
  );
}
