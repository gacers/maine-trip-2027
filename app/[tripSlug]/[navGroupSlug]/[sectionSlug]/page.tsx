import { notFound } from "next/navigation";
import { getTripBySlug, getSectionBySlug, sanitizeTripForClient } from "@/lib/sections";
import { getAdminUser } from "@/lib/auth";
import { isEditorForTrip } from "@/lib/tripEditors";
import SectionPage from "@/components/SectionPage";

export const dynamic = "force-dynamic";

interface Params {
  tripSlug: string;
  navGroupSlug: string;
  sectionSlug: string;
}

export default async function TripSectionPage({ params }: { params: Promise<Params> }) {
  const { tripSlug, navGroupSlug, sectionSlug } = await params;
  const trip = await getTripBySlug(tripSlug);
  if (!trip) notFound();

  const section = await getSectionBySlug(trip.id, navGroupSlug, sectionSlug);
  if (!section) notFound();

  const admin = await getAdminUser();
  const isEditor = admin ? false : await isEditorForTrip(trip.id);

  // SectionPage is a Client Component — its props are serialized into
  // the page's own source, so the raw trip row (carrying the real,
  // standing sheet_invite_token) must never be passed through as-is.
  return (
    <SectionPage
      trip={sanitizeTripForClient(trip)}
      section={section}
      navGroupSlug={navGroupSlug}
      isAdmin={!!admin}
      isEditor={isEditor}
    />
  );
}
