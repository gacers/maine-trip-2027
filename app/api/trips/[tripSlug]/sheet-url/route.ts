import { NextResponse, type NextRequest } from "next/server";
import { getTripBySlug } from "@/lib/sections";
import { requireWriteAccess } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// trip.google_sheet_url is gated the same as the Add form (an admin
// session, or an owner/contributor invite token) — it must never reach
// the page's own props for a visitor who hasn't proven one of those
// (see sanitizeTripForClient, which strips it before SectionPage ever
// renders). The client fetches it here, with real auth, only once it
// already knows it has access.
export async function GET(request: NextRequest, { params }: { params: Promise<{ tripSlug: string }> }) {
  const { tripSlug } = await params;
  const trip = await getTripBySlug(tripSlug);
  if (!trip) return NextResponse.json({ error: "Unknown trip" }, { status: 404 });

  const { error: authError } = await requireWriteAccess(request, trip.id, { minRole: "editor" });
  if (authError) return NextResponse.json({ error: authError.message }, { status: authError.status });

  return NextResponse.json({ googleSheetUrl: trip.google_sheet_url || null });
}
