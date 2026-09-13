import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { getTripBySlug } from "@/lib/sections";
import { requireWriteAccess, hashApiKey } from "@/lib/auth";
import { supabaseServiceRole } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// api_keys has no RLS policies at all (same lockdown as app_admins) —
// intentionally, since it's a privileged table. requireWriteAccess()
// below is only used for the yes/no authorization check; the actual
// table access always goes through the service-role client regardless
// of *which* path (bearer key or interactive session) passed that
// check, since a real admin's own session client would otherwise be
// blocked reading/writing this table by its RLS lockdown too.

export async function GET(request, { params }) {
  const { tripSlug } = await params;
  const trip = await getTripBySlug(tripSlug);
  if (!trip) return NextResponse.json({ error: "Unknown trip" }, { status: 404 });

  const { error: authError } = await requireWriteAccess(request, trip.id);
  if (authError) return NextResponse.json({ error: authError.message }, { status: authError.status });

  try {
    const service = supabaseServiceRole();
    // key_hash is never returned — knowing it would let anyone forge
    // the bearer token's hash comparison offline. It stays server-only.
    const { data, error } = await service
      .from("api_keys")
      .select("id, trip_id, label, created_at, last_used_at, revoked")
      .or(`trip_id.eq.${trip.id},trip_id.is.null`)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return NextResponse.json({ apiKeys: data });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// Generates a new key scoped to this trip. The raw token is returned
// exactly once here — only its sha256 hash is ever stored.
export async function POST(request, { params }) {
  const { tripSlug } = await params;
  const trip = await getTripBySlug(tripSlug);
  if (!trip) return NextResponse.json({ error: "Unknown trip" }, { status: 404 });

  const { error: authError } = await requireWriteAccess(request, trip.id);
  if (authError) return NextResponse.json({ error: authError.message }, { status: authError.status });

  let body;
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const label = body.label || `Key for ${trip.name}`;

  try {
    const service = supabaseServiceRole();
    const token = "sk_" + randomBytes(24).toString("base64url");
    const { data, error } = await service
      .from("api_keys")
      .insert({ trip_id: trip.id, label, key_hash: hashApiKey(token) })
      .select("id, trip_id, label, created_at, last_used_at, revoked")
      .single();
    if (error) throw new Error(error.message);
    return NextResponse.json({ apiKey: data, token }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
