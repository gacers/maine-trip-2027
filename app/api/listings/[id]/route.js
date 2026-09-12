import { NextResponse } from "next/server";
import { getAllListings, updateListingByRow, deleteListingByRow } from "@/lib/sheets";

const EDITABLE_FIELDS = [
  "rank",
  "title",
  "price",
  "posterImage",
  "status",
  "archiveReason",
  "lat",
  "lng",
  "notes",
];

export async function PATCH(request, { params }) {
  const { id } = await params;
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

  try {
    const all = await getAllListings();
    const existing = all.find((l) => l.id === id);
    if (!existing) {
      return NextResponse.json({ error: "Listing not found" }, { status: 404 });
    }
    const updated = await updateListingByRow(existing._row, patch);
    return NextResponse.json({ listing: updated });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  const { id } = await params;
  try {
    const all = await getAllListings();
    const existing = all.find((l) => l.id === id);
    if (!existing) {
      return NextResponse.json({ error: "Listing not found" }, { status: 404 });
    }
    await deleteListingByRow(existing._row);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
