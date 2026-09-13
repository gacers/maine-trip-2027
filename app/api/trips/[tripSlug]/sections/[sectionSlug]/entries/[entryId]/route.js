import { NextResponse } from "next/server";
import { getTripBySlug, getSectionBySlug } from "@/lib/sections";
import { getAllEntries, updateEntry, deleteEntry, toClientEntry } from "@/lib/entries";
import { requireWriteAccess } from "@/lib/auth";
import { extractCount } from "@/lib/fieldTypes/count";
import { exportSection } from "@/lib/sheetsExport";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const CORE_TO_COLUMN = {
  rank: "rank",
  title: "title",
  url: "url",
  posterImage: "poster_image",
  description: "description",
  status: "status",
  archiveReason: "archive_reason",
  lat: "lat",
  lng: "lng",
  notes: "notes",
  concerns: "concerns",
  groupLabel: "group_label",
};

async function resolveTripAndSection(tripSlug, sectionSlug) {
  const trip = await getTripBySlug(tripSlug);
  if (!trip) return { notFound: NextResponse.json({ error: "Unknown trip" }, { status: 404 }) };
  const section = await getSectionBySlug(trip.id, sectionSlug);
  if (!section) return { notFound: NextResponse.json({ error: "Unknown section" }, { status: 404 }) };
  return { trip, section };
}

export async function PATCH(request, { params }) {
  const { tripSlug, sectionSlug, entryId } = await params;
  const { trip, section, notFound } = await resolveTripAndSection(tripSlug, sectionSlug);
  if (notFound) return notFound;

  const { error: authError, supabase } = await requireWriteAccess(request, trip.id);
  if (authError) return NextResponse.json({ error: authError.message }, { status: authError.status });

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const patch = {};
  for (const [key, column] of Object.entries(CORE_TO_COLUMN)) {
    if (key in body) patch[column] = body[key];
  }

  const dataPatch = body.data && typeof body.data === "object" ? body.data : null;

  if (Object.keys(patch).length === 0 && !dataPatch) {
    return NextResponse.json({ error: "No editable fields provided" }, { status: 400 });
  }

  try {
    if (dataPatch) {
      const all = await getAllEntries(supabase, section.id);
      const existing = all.find((e) => e.id === entryId);
      if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
      const mergedData = { ...existing.data, ...dataPatch };

      // If the description changed but a count field wasn't explicitly
      // patched alongside it, re-extract it — same as today's PATCH
      // route's bedroom/bed/bathroom re-parse behavior.
      if ("description" in patch) {
        for (const fieldDef of section.field_defs) {
          if (fieldDef.field_type === "count" && !(fieldDef.key in dataPatch)) {
            const extracted = extractCount(patch.description, fieldDef);
            if (extracted !== "") mergedData[fieldDef.key] = extracted;
          }
        }
      }
      patch.data = mergedData;
    }

    const entry = await updateEntry(supabase, entryId, patch);
    await exportSection(supabase, trip, section);
    return NextResponse.json({ entry: toClientEntry(entry) });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  const { tripSlug, sectionSlug, entryId } = await params;
  const { trip, section, notFound } = await resolveTripAndSection(tripSlug, sectionSlug);
  if (notFound) return notFound;

  const { error: authError, supabase } = await requireWriteAccess(request, trip.id);
  if (authError) return NextResponse.json({ error: authError.message }, { status: authError.status });

  try {
    await deleteEntry(supabase, entryId);
    await exportSection(supabase, trip, section);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
