import { redirect, notFound } from "next/navigation";
import { getTripBySlug, getTripNav } from "@/lib/sections";

export const dynamic = "force-dynamic";

// Visiting a bare trip URL (/{tripSlug}) redirects to its first section,
// e.g. /maine-2027 -> /maine-2027/houses — matching how "/" used to just
// be the listings page directly.
export default async function TripDefaultPage({ params }) {
  const { tripSlug } = await params;
  const trip = await getTripBySlug(tripSlug);
  if (!trip) notFound();

  const nav = await getTripNav(trip.id);
  const firstSection = nav.find((g) => g.sections.length > 0)?.sections[0];
  if (!firstSection) notFound();

  redirect(`/${tripSlug}/${firstSection.slug}`);
}
