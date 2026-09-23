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
  // trip/admin are independent of each other; section/isEditor both
  // only need trip.id (known once the first pair resolves) and aren't
  // needed by each other either — isEditorForTrip only actually runs
  // when it'll be used (skipping it outright for an admin, not just
  // discarding its result), so this is 2 round trips instead of the
  // previous up-to-4 fully sequential ones, with no wasted query added
  // for the admin case.
  const [trip, admin] = await Promise.all([getTripBySlug(tripSlug), getAdminUser()]);
  if (!trip) notFound();

  const [section, isEditor] = await Promise.all([
    getSectionBySlug(trip.id, navGroupSlug, sectionSlug),
    admin ? Promise.resolve(false) : isEditorForTrip(trip.id),
  ]);
  if (!section) notFound();

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
