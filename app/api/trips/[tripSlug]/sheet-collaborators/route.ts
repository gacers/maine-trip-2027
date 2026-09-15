import { NextResponse, type NextRequest } from "next/server";
import { getTripBySlug } from "@/lib/sections";
import { requireWriteAccess } from "@/lib/auth";
import { addSheetCollaborator } from "@/lib/drive";

export const dynamic = "force-dynamic";

// Admin-only: grants one specific person real Google Sheets access
// (not just "anyone with the link can view," which every Sheet already
// gets on creation) — see lib/drive.ts's addSheetCollaborator.
export async function POST(request: NextRequest, { params }: { params: Promise<{ tripSlug: string }> }) {
  const { tripSlug } = await params;
  const trip = await getTripBySlug(tripSlug);
  if (!trip) return NextResponse.json({ error: "Unknown trip" }, { status: 404 });

  const { error: authError } = await requireWriteAccess(request, trip.id);
  if (authError) return NextResponse.json({ error: authError.message }, { status: authError.status });

  if (!trip.google_sheet_id) {
    return NextResponse.json({ error: "This trip doesn't have a Sheet yet — create it first." }, { status: 400 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim() : "";
  const role = body.role === "reader" ? "reader" : "writer";
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "A valid email address is required" }, { status: 400 });
  }

  try {
    await addSheetCollaborator(trip.google_sheet_id, email, role);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
