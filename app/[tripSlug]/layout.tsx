import { notFound } from "next/navigation";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { getTripBySlug, getTripNav, sanitizeTripForClient } from "@/lib/sections";
import { getAdminUser } from "@/lib/auth";
import { isEditorForTrip } from "@/lib/tripEditors";
import { getContactEmail } from "@/lib/settings";
import TripNavHeader from "@/components/TripNavHeader";
import { NavSlotProvider } from "@/components/TripNavHeader/NavSlot";
import TripAccessGate from "@/components/TripAccessGate";

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
  // Only worth checking once we already know this visitor isn't an
  // admin — an admin's own access already covers everything an editor
  // would, and app_admins/trip_editors are deliberately separate
  // tables (see supabase/migrations/0021_trip_editors.sql).
  const isEditor = admin ? false : await isEditorForTrip(trip.id);
  const publicTrip = sanitizeTripForClient(trip);

  return (
    <NavSlotProvider>
      {/* TripNavHeader is a Client Component — anything passed to it
          gets serialized into the page's own source, so the raw trip
          row (carrying sheet_invite_token) must never go here as-is. */}
      <TripNavHeader
        trip={publicTrip}
        nav={nav}
        isAdmin={!!admin}
        isEditor={isEditor}
        contactEmail={contactEmail}
      />
      {/* Everything below the nav bar — the actual trip content — waits
          on this; a total stranger (no login, no invite token) gets a
          login/request-access prompt instead. See TripAccessGate's own
          comment for why the nav bar above isn't gated too, and what
          this is (and isn't) actually protecting against. Admin routes
          are unaffected: TripAdminLayout's own redirect() for a
          non-admin fires first and unwinds this whole render before
          the gate would ever get a say. */}
      <TripAccessGate trip={publicTrip} isAdmin={!!admin} isEditor={isEditor} contactEmail={contactEmail}>
        {children}
      </TripAccessGate>
    </NavSlotProvider>
  );
}
