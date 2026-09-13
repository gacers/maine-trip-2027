import { NextResponse } from "next/server";
import { getAllTrips } from "@/lib/sections";
import { requireWriteAccess } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const trips = await getAllTrips();
    return NextResponse.json({ trips });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// "One stop shop" new-trip action (Phase 2 gets a real form on top of
// this; the route itself is Phase 1 so the capability exists early).
export async function POST(request) {
  const { error: authError, supabase } = await requireWriteAccess(request);
  if (authError) return NextResponse.json({ error: authError.message }, { status: authError.status });

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { slug, name, subtitle, startDate, endDate, mapConfig } = body;
  if (!slug || !name) {
    return NextResponse.json({ error: "slug and name are required" }, { status: 400 });
  }
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) {
    return NextResponse.json(
      { error: "slug must be lowercase letters/numbers separated by hyphens (e.g. iceland-2028)" },
      { status: 400 }
    );
  }

  try {
    const { data: trip, error } = await supabase
      .from("trips")
      .insert({
        slug,
        name,
        subtitle: subtitle || null,
        start_date: startDate || null,
        end_date: endDate || null,
        map_config: mapConfig || {},
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return NextResponse.json({ trip }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
