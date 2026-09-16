import { NextResponse, type NextRequest } from "next/server";
import { getTripBySlug } from "@/lib/sections";
import { requireWriteAccess } from "@/lib/auth";
import { supabaseServiceRole } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// The "cut everyone off" button: every permanent editor on this trip
// loses their trip_editors row, and every contributor-role api_keys
// row (every invite link, *and* the Sheet's own embedded invite token —
// see ensureSheetInviteToken, which is just another contributor key)
// gets revoked. Deliberately does NOT auto-issue a fresh Sheet token
// afterward — "revoke all" should actually mean nobody has standing
// access anymore, not quietly hand out a replacement in the same
// breath. Re-exporting or rotating the Sheet afterward (SheetAccessBox)
// mints a new one whenever that's actually wanted again. Owner-role
// keys (Claude Desktop/automation, managed separately in API Keys)
// are untouched — this is specifically about *access someone else was
// given*, not your own tooling.
export async function POST(request: NextRequest, { params }: { params: Promise<{ tripSlug: string }> }) {
  const { tripSlug } = await params;
  const trip = await getTripBySlug(tripSlug);
  if (!trip) return NextResponse.json({ error: "Unknown trip" }, { status: 404 });

  const { error: authError } = await requireWriteAccess(request, trip.id);
  if (authError) return NextResponse.json({ error: authError.message }, { status: authError.status });

  try {
    const service = supabaseServiceRole();
    const [editorsRes, keysRes] = await Promise.all([
      service.from("trip_editors").delete().eq("trip_id", trip.id).select("user_id"),
      service
        .from("api_keys")
        .update({ revoked: true })
        .eq("trip_id", trip.id)
        .eq("role", "contributor")
        .eq("revoked", false)
        .select("id"),
    ]);
    if (editorsRes.error) throw new Error(editorsRes.error.message);
    if (keysRes.error) throw new Error(keysRes.error.message);

    return NextResponse.json({
      editorsRevoked: editorsRes.data?.length || 0,
      keysRevoked: keysRes.data?.length || 0,
    });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
