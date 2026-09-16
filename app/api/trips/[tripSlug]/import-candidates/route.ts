import { NextResponse, type NextRequest } from "next/server";
import { getTripBySlug } from "@/lib/sections";
import { findEntriesForConceptSlug } from "@/lib/entries";
import { supabaseServer } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Backs SectionsAdmin's "also copy in N existing entries" checkbox,
// shown once a custom template's Previously Visited counterpart is
// checked — a cheap up-front count/preview so an admin can see what
// they'd actually get before committing to it (the real copy happens
// in the entries/import route once a section exists to copy into).
export async function GET(request: NextRequest, { params }: { params: Promise<{ tripSlug: string }> }) {
  const { tripSlug } = await params;
  const trip = await getTripBySlug(tripSlug);
  if (!trip) return NextResponse.json({ error: "Unknown trip" }, { status: 404 });

  const slug = (new URL(request.url).searchParams.get("slug") || "").trim();
  if (!slug) return NextResponse.json({ error: "slug is required" }, { status: 400 });

  const supabase = await supabaseServer();
  const entries = await findEntriesForConceptSlug(supabase, slug, trip.id);
  const tripNames = [...new Set(entries.map((e) => e.tripName))];
  return NextResponse.json({ count: entries.length, tripNames });
}
