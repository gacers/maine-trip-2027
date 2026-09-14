import { notFound } from "next/navigation";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { getTripBySlug, getTripNav, sanitizeTripForClient } from "@/lib/sections";
import { getAdminUser } from "@/lib/auth";
import { getContactEmail } from "@/lib/settings";
import TripNavHeader from "@/components/TripNavHeader";
import { NavSlotProvider } from "@/components/TripNavHeader/NavSlot";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ tripSlug: string }> }): Promise<Metadata> {
  const { tripSlug } = await params;
  const trip = await getTripBySlug(tripSlug);
  return { title: trip ? trip.name : "Trip not found" };
}

export default async function TripLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ tripSlug: string }>;
}) {
  const { tripSlug } = await params;
  const trip = await getTripBySlug(tripSlug);
  if (!trip) notFound();
  const [nav, admin, contactEmail] = await Promise.all([getTripNav(trip.id), getAdminUser(), getContactEmail()]);

  return (
    <NavSlotProvider>
      {/* TripNavHeader is a Client Component — anything passed to it
          gets serialized into the page's own source, so the raw trip
          row (carrying sheet_invite_token) must never go here as-is. */}
      <TripNavHeader trip={sanitizeTripForClient(trip)} nav={nav} isAdmin={!!admin} contactEmail={contactEmail} />
      {children}
    </NavSlotProvider>
  );
}
