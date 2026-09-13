import { NextResponse } from "next/server";
import { getTripBySlug } from "@/lib/sections";
import { requireWriteAccess } from "@/lib/auth";
import { supabaseServiceRole } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Revoke only — keys are never un-revoked or deleted outright, so a
// compromised/rotated key can't accidentally come back to life.
export async function PATCH(request, { params }) {
  const { tripSlug, keyId } = await params;
  const trip = await getTripBySlug(tripSlug);
  if (!trip) return NextResponse.json({ error: "Unknown trip" }, { status: 404 });

  const { error: authError } = await requireWriteAccess(request, trip.id);
  if (authError) return NextResponse.json({ error: authError.message }, { status: authError.status });

  try {
    const service = supabaseServiceRole();
    const { data, error } = await service
      .from("api_keys")
      .update({ revoked: true })
      .eq("id", keyId)
      .select("id, trip_id, label, created_at, last_used_at, revoked")
      .single();
    if (error) throw new Error(error.message);
    return NextResponse.json({ apiKey: data });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
