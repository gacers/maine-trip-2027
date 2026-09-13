import { notFound } from "next/navigation";
import { getTripBySlug, getSectionBySlug } from "@/lib/sections";
import SectionPage from "@/components/SectionPage";

export const dynamic = "force-dynamic";

export default async function TripSectionPage({ params }) {
  const { tripSlug, sectionSlug } = await params;
  const trip = await getTripBySlug(tripSlug);
  if (!trip) notFound();

  const section = await getSectionBySlug(trip.id, sectionSlug);
  if (!section) notFound();

  return <SectionPage trip={trip} section={section} />;
}
