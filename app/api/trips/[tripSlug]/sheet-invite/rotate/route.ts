import { NextResponse, type NextRequest } from "next/server";
import { getTripBySlug, getAllSectionsForTrip } from "@/lib/sections";
import { requireWriteAccess } from "@/lib/auth";
import { rotateSheetInviteToken, exportSection } from "@/lib/sheetsExport";

export const dynamic = "force-dynamic";

// Owner/admin only (no allowContributor) — revokes the invite token
// currently embedded in this trip's Sheet and bakes a fresh one into
// every tab immediately, so any copy of the old link (screenshotted,
// forwarded outside the group it was meant for, etc.) stops working
// right away rather than whenever the Sheet next happens to re-export.
export async function POST(request: NextRequest, { params }: { params: Promise<{ tripSlug: string }> }) {
  const { tripSlug } = await params;
  const trip = await getTripBySlug(tripSlug);
  if (!trip) return NextResponse.json({ error: "Unknown trip" }, { status: 404 });

  const { error: authError, supabase } = await requireWriteAccess(request, trip.id);
  if (authError) return NextResponse.json({ error: authError.message }, { status: authError.status });

  try {
    await rotateSheetInviteToken(trip);
    const sections = await getAllSectionsForTrip(trip.id);
    for (const section of sections) {
      await exportSection(supabase, trip, section);
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
