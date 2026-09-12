import { NextResponse } from "next/server";
import { getCollectionBySlug } from "@/lib/collections";
import { extractCounts } from "@/lib/extractCounts";
import { getAllItems, updateItemByRow, deleteItemByRow } from "@/lib/sheets";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const EDITABLE_FIELDS = [
  "rank",
  "title",
  "price",
  "posterImage",
  "description",
  "status",
  "archiveReason",
  "lat",
  "lng",
  "extraMarkers",
  "notes",
  "concerns",
  "bedrooms",
  "beds",
  "bathrooms",
  "groupLabel",
];

export async function PATCH(request, { params }) {
  const { collection: slug, id } = await params;
  const collection = getCollectionBySlug(slug);
  if (!collection) {
    return NextResponse.json({ error: "Unknown collection" }, { status: 404 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const patch = {};
  for (const key of EDITABLE_FIELDS) {
    if (key in body) patch[key] = body[key];
  }
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "No editable fields provided" }, { status: 400 });
  }

  // If the description changed but bed/bath counts weren't explicitly
  // patched alongside it, re-parse them from the new text.
  if ("description" in patch && !("bedrooms" in patch) && !("beds" in patch) && !("bathrooms" in patch)) {
    const counts = extractCounts(patch.description);
    if (counts.bedrooms !== "") patch.bedrooms = counts.bedrooms;
    if (counts.beds !== "") patch.beds = counts.beds;
    if (counts.bathrooms !== "") patch.bathrooms = counts.bathrooms;
  }

  try {
    const all = await getAllItems(collection);
    const existing = all.find((l) => l.id === id);
    if (!existing) {
      return NextResponse.json({ error: "Listing not found" }, { status: 404 });
    }
    const updated = await updateItemByRow(collection, existing._row, patch);
    return NextResponse.json({ listing: updated });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  const { collection: slug, id } = await params;
  const collection = getCollectionBySlug(slug);
  if (!collection) {
    return NextResponse.json({ error: "Unknown collection" }, { status: 404 });
  }

  try {
    const all = await getAllItems(collection);
    const existing = all.find((l) => l.id === id);
    if (!existing) {
      return NextResponse.json({ error: "Listing not found" }, { status: 404 });
    }
    await deleteItemByRow(collection, existing._row);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
