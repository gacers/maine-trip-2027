import { NextResponse, type NextRequest } from "next/server";
import { getTripBySlug } from "@/lib/sections";
import { requireWriteAccess } from "@/lib/auth";
import { supabaseServiceRole } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Revokes one editor's access to this one trip — a plain delete of
// their trip_editors row (no `revoked` flag exists on this table, see
// its migration), not a deletion of their actual account, which may
// still be a real editor on other trips or just able to sign in with
// nothing granted anywhere.
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ tripSlug: string; userId: string }> }
) {
  const { tripSlug, userId } = await params;
  const trip = await getTripBySlug(tripSlug);
  if (!trip) return NextResponse.json({ error: "Unknown trip" }, { status: 404 });

  const { error: authError } = await requireWriteAccess(request, trip.id);
  if (authError) return NextResponse.json({ error: authError.message }, { status: authError.status });

  try {
    const service = supabaseServiceRole();
    const { error } = await service.from("trip_editors").delete().eq("trip_id", trip.id).eq("user_id", userId);
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
