import { NextResponse, type NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getTripBySlug } from "@/lib/sections";
import { getAllEntries, updateEntry } from "@/lib/entries";
import { requireWriteAccess } from "@/lib/auth";
import { exportSection } from "@/lib/sheetsExport";
import type { Section } from "@/lib/types";

export const dynamic = "force-dynamic";

interface SectionCount {
  navGroupSlug: string;
  sectionLabel: string;
  toArchive: number;
}

async function loadSectionsWithGroupSlug(
  supabase: SupabaseClient,
  tripId: string
): Promise<(Section & { navGroupSlug: string })[]> {
  const { data, error } = await supabase
    .from("sections")
    .select("*, field_defs(*), nav_groups!inner(slug)")
    .eq("trip_id", tripId);
  if (error) throw new Error(error.message);
  return (data || []).map((row) => {
    const { nav_groups, ...section } = row as Section & { nav_groups: { slug: string } };
    return { ...section, navGroupSlug: nav_groups.slug };
  });
}

// Admin-only, and gated on trip.completed by the button itself (see
// ArchiveUnvisitedButton) — the actual archive sweep this trip's
// "Completed" checkbox in TripSettingsForm deliberately does NOT
// trigger on its own (see the conversation this was designed in): an
// explicit, separate action so nothing gets archived by a stray click
// before you've had the chance to check off what was actually stayed
// at/visited.
//
// GET returns a preview (counts per section, nothing changed yet) so
// the confirm dialog can show exactly what a POST would do; POST does
// the real sweep and returns the same shape once it's done.
async function computeAndMaybeArchive(
  request: NextRequest,
  tripSlug: string,
  { dryRun }: { dryRun: boolean }
) {
  const trip = await getTripBySlug(tripSlug);
  if (!trip) return NextResponse.json({ error: "Unknown trip" }, { status: 404 });

  const { error: authError, supabase } = await requireWriteAccess(request, trip.id);
  if (authError) return NextResponse.json({ error: authError.message }, { status: authError.status });

  try {
    const sections = await loadSectionsWithGroupSlug(supabase!, trip.id);
    const counts: SectionCount[] = [];
    let totalArchived = 0;
    const touchedSections: Section[] = [];

    for (const section of sections) {
      const rows = await getAllEntries(supabase!, section.id);
      const toArchive = rows.filter((r) => r.status === "active" && !r.visited);
      if (toArchive.length === 0) continue;

      counts.push({ navGroupSlug: section.navGroupSlug, sectionLabel: section.label, toArchive: toArchive.length });
      totalArchived += toArchive.length;

      if (!dryRun) {
        for (const row of toArchive) {
          await updateEntry(supabase!, row.id, {
            status: "archived",
            archive_reason: "Trip completed — not marked stayed/visited",
          });
        }
        touchedSections.push(section);
      }
    }

    if (!dryRun) {
      for (const section of touchedSections) {
        await exportSection(supabase!, trip, section);
      }
    }

    return NextResponse.json({ counts, totalArchived });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ tripSlug: string }> }) {
  const { tripSlug } = await params;
  return computeAndMaybeArchive(request, tripSlug, { dryRun: true });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ tripSlug: string }> }) {
  const { tripSlug } = await params;
  return computeAndMaybeArchive(request, tripSlug, { dryRun: false });
}
