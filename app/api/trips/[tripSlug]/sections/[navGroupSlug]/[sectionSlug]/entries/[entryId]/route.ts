import { NextResponse, type NextRequest } from "next/server";
import { getTripBySlug, getSectionBySlug } from "@/lib/sections";
import { getAllEntries, updateEntry, deleteEntry, toClientEntry } from "@/lib/entries";
import { requireWriteAccess } from "@/lib/auth";
import { extractCount } from "@/lib/fieldTypes/count";
import { exportSection } from "@/lib/sheetsExport";
import { isSyncedEntryFieldPatch, propagateEntryUpdateFromSource } from "@/lib/entrySync";
import type { EntryRow, Trip, Section } from "@/lib/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const CORE_TO_COLUMN: Record<string, keyof EntryRow> = {
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
  visited: "visited",
  visitedDate: "visited_date",
};

async function resolveTripAndSection(
  tripSlug: string,
  navGroupSlug: string,
  sectionSlug: string
): Promise<{ trip: Trip; section: Section; notFound?: undefined } | { notFound: NextResponse; trip?: undefined; section?: undefined }> {
  const trip = await getTripBySlug(tripSlug);
  if (!trip) return { notFound: NextResponse.json({ error: "Unknown trip" }, { status: 404 }) };
  const section = await getSectionBySlug(trip.id, navGroupSlug, sectionSlug);
  if (!section) return { notFound: NextResponse.json({ error: "Unknown section" }, { status: 404 }) };
  return { trip, section };
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ tripSlug: string; navGroupSlug: string; sectionSlug: string; entryId: string }> }
) {
  const { tripSlug, navGroupSlug, sectionSlug, entryId } = await params;
  const { trip, section, notFound } = await resolveTripAndSection(tripSlug, navGroupSlug, sectionSlug);
  if (notFound) return notFound;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // A contributor (invite-link) token can edit any field here, archive
  // an entry (status + archiveReason), and append a note/concern — the
  // full range of what PATCH itself can do. It stops short of DELETE
  // (see below), which stays owner-only: archiving is reversible and
  // still leaves the entry in the archived list, permanent delete
  // isn't.
  const { error: authError, supabase } = await requireWriteAccess(request, trip.id, {
    minRole: "editor",
  });
  if (authError) return NextResponse.json({ error: authError.message }, { status: authError.status });

  const patch: Partial<EntryRow> = {};
  for (const [key, column] of Object.entries(CORE_TO_COLUMN)) {
    if (key in body) (patch as Record<string, unknown>)[column] = body[key];
  }
  // EntryCard's own edit form sends "" (not null) for a cleared lat/lng
  // — sent straight through to a double precision column, that's a
  // real Postgres error, not a silent no-op. (body's own values are
  // untyped, so a cleared field really can arrive as "" here despite
  // patch's own EntryRow-shaped type.)
  const loosePatch = patch as Record<string, unknown>;
  if (loosePatch.lat === "") patch.lat = null;
  if (loosePatch.lng === "") patch.lng = null;

  const dataPatch = body.data && typeof body.data === "object" ? (body.data as Record<string, unknown>) : null;
  // appendNote/appendConcern add one more bullet to the existing list
  // (each is a "\n"-joined string under the hood, same convention as
  // description) instead of replacing the whole thing — the same
  // operation whether it comes from the site's "+ Add note" button or
  // from a Claude Desktop message asking to add one to an existing
  // entry, since both just PATCH this same field.
  const appendNote = typeof body.appendNote === "string" ? body.appendNote.trim() : null;
  const appendConcern = typeof body.appendConcern === "string" ? body.appendConcern.trim() : null;

  if (Object.keys(patch).length === 0 && !dataPatch && !appendNote && !appendConcern) {
    return NextResponse.json({ error: "No editable fields provided" }, { status: 400 });
  }

  try {
    // Fetched unconditionally (not just alongside dataPatch/appendNote/
    // appendConcern like before) — a synced entry's own shared fields
    // (see lib/entrySync.ts) need this check regardless of which
    // fields the request actually touches.
    const all = await getAllEntries(supabase!, section.id);
    const existing = all.find((e) => e.id === entryId);
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (existing.import_source_entry_id && (isSyncedEntryFieldPatch(patch) || dataPatch)) {
      return NextResponse.json(
        { error: "This entry's shared fields are synced from its source — edit them there instead." },
        { status: 400 }
      );
    }

    if (dataPatch || appendNote || appendConcern) {
      if (dataPatch) {
        const mergedData: Record<string, unknown> = { ...existing.data, ...dataPatch };

        // If the description changed but a count field wasn't explicitly
        // patched alongside it, re-extract it — same as today's PATCH
        // route's bedroom/bed/bathroom re-parse behavior.
        if ("description" in patch) {
          for (const fieldDef of section.field_defs || []) {
            if (fieldDef.field_type === "count" && !(fieldDef.key in dataPatch)) {
              const extracted = extractCount(patch.description, fieldDef);
              if (extracted !== "") mergedData[fieldDef.key] = extracted;
            }
          }
        }
        patch.data = mergedData;
      }

      if (appendNote) {
        patch.notes = existing.notes ? `${existing.notes}\n${appendNote}` : appendNote;
      }
      if (appendConcern) {
        patch.concerns = existing.concerns ? `${existing.concerns}\n${appendConcern}` : appendConcern;
      }
    }

    const entry = await updateEntry(supabase!, entryId, patch);
    await exportSection(supabase!, trip, section);
    // Best-effort — this entry might itself be the import source for
    // one or more entries elsewhere (see lib/entrySync.ts); harmless
    // no-op otherwise. Only worth the extra round trip when a synced
    // field actually changed.
    if (isSyncedEntryFieldPatch(patch) || dataPatch) {
      propagateEntryUpdateFromSource(entryId).catch((err) => console.error("Entry sync propagation failed:", err));
    }
    return NextResponse.json({ entry: toClientEntry(entry) });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ tripSlug: string; navGroupSlug: string; sectionSlug: string; entryId: string }> }
) {
  const { tripSlug, navGroupSlug, sectionSlug, entryId } = await params;
  const { trip, section, notFound } = await resolveTripAndSection(tripSlug, navGroupSlug, sectionSlug);
  if (notFound) return notFound;

  const { error: authError, supabase } = await requireWriteAccess(request, trip.id);
  if (authError) return NextResponse.json({ error: authError.message }, { status: authError.status });

  try {
    await deleteEntry(supabase!, entryId);
    await exportSection(supabase!, trip, section);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
