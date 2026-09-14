import { NextResponse, type NextRequest } from "next/server";
import { getTripBySlug } from "@/lib/sections";
import { requireWriteAccess } from "@/lib/auth";
import { supabaseServiceRole } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Returns a previously-created key's raw token again, for a key created
// after token_plaintext started being stored (see migration
// 0008_api_key_plaintext.sql) — a key from before that still only has
// its hash, so there's genuinely nothing to return; revoke and create a
// fresh one instead. Owner/admin only — this is strictly more sensitive
// than the create endpoint since it can be called any number of times.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tripSlug: string; keyId: string }> }
) {
  const { tripSlug, keyId } = await params;
  const trip = await getTripBySlug(tripSlug);
  if (!trip) return NextResponse.json({ error: "Unknown trip" }, { status: 404 });

  const { error: authError } = await requireWriteAccess(request, trip.id);
  if (authError) return NextResponse.json({ error: authError.message }, { status: authError.status });

  try {
    const service = supabaseServiceRole();
    const { data, error } = await service
      .from("api_keys")
      .select("token_plaintext, trip_id")
      .eq("id", keyId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data || (data.trip_id && data.trip_id !== trip.id)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (!data.token_plaintext) {
      return NextResponse.json(
        { error: "This key was created before this was supported — revoke it and create a new one." },
        { status: 404 }
      );
    }
    return NextResponse.json({ token: data.token_plaintext });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
