import { notFound } from "next/navigation";
import { getTripBySlug, getTripNav } from "@/lib/sections";
import TripNavHeader from "@/components/TripNavHeader";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }) {
  const { tripSlug } = await params;
  const trip = await getTripBySlug(tripSlug);
  return { title: trip ? trip.name : "Trip not found" };
}

export default async function TripLayout({ children, params }) {
  const { tripSlug } = await params;
  const trip = await getTripBySlug(tripSlug);
  if (!trip) notFound();
  const nav = await getTripNav(trip.id);

  return (
    <>
      <TripNavHeader trip={trip} nav={nav} />
      {children}
    </>
  );
}
