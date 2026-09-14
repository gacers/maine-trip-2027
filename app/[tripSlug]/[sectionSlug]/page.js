import { notFound } from "next/navigation";
import { getTripBySlug, getSectionBySlug, sanitizeTripForClient } from "@/lib/sections";
import { getAdminUser } from "@/lib/auth";
import { getContactEmail } from "@/lib/settings";
import SectionPage from "@/components/SectionPage";

export const dynamic = "force-dynamic";

export default async function TripSectionPage({ params }) {
  const { tripSlug, sectionSlug } = await params;
  const trip = await getTripBySlug(tripSlug);
  if (!trip) notFound();

  const section = await getSectionBySlug(trip.id, sectionSlug);
  if (!section) notFound();

  const [admin, contactEmail] = await Promise.all([getAdminUser(), getContactEmail()]);

  // SectionPage is a Client Component — its props are serialized into
  // the page's own source, so the raw trip row (carrying the real,
  // standing sheet_invite_token) must never be passed through as-is.
  return (
    <SectionPage
      trip={sanitizeTripForClient(trip)}
      section={section}
      isAdmin={!!admin}
      contactEmail={contactEmail}
    />
  );
}
