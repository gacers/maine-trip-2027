import { NextResponse, type NextRequest } from "next/server";
import { getTripBySlug } from "@/lib/sections";
import { requireReadAccess } from "@/lib/auth";
import { getImportSourceEntryInfo } from "@/lib/entrySync";
import { supabaseServiceRole } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Resolves a locked entry's own source into a real link — fetched
// lazily by EntryEditForm only once it's actually open on an entry
// whose own importSourceEntryId is set, rather than eagerly joining
// this for every entry on every ordinary list load. Scoped by
// tripSlug + a plain entries.id lookup (entries.id is globally unique,
// not scoped per section) rather than the full nav-group/section-slug
// path every other entries route uses — this is the one entry lookup
// that doesn't need a section in hand at all, and threading
// navGroupSlug/sectionSlug all the way down through EntryCard's own
// prop chain just for this would be a lot of plumbing for one lazy
// lookup.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tripSlug: string; entryId: string }> }
) {
  const { tripSlug, entryId } = await params;
  const trip = await getTripBySlug(tripSlug);
  if (!trip) return NextResponse.json({ error: "Unknown trip" }, { status: 404 });

  const { error: authError } = await requireReadAccess(request, trip.id);
  if (authError) return NextResponse.json({ error: authError.message }, { status: authError.status });

  try {
    // Service role for the lookup itself — requireReadAccess above
    // already confirmed this caller can read THIS trip; the actual
    // query just needs the entry to belong to it, checked explicitly
    // below rather than relying on RLS to also cover this shape.
    const supabase = supabaseServiceRole();
    const { data: entry, error } = await supabase
      .from("entries")
      .select("id, trip_id, import_source_entry_id")
      .eq("id", entryId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!entry || entry.trip_id !== trip.id) return NextResponse.json({ error: "Unknown entry" }, { status: 404 });
    if (!entry.import_source_entry_id) return NextResponse.json({ source: null });

    const source = await getImportSourceEntryInfo(entry.import_source_entry_id);
    return NextResponse.json({ source });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
