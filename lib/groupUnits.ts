import type { ClientEntry, EntryUnit } from "@/lib/types";

// Pairs up items sharing a non-empty groupLabel (a "2-house option", or
// any other paired option) into one "group" unit; everything else is a
// "solo" unit. Both the client-side pages (which unit type drives
// rendering) and the server-side Overview-sheet sync (which needs one
// row per bookable thing, not one row per item) need exactly this same
// pairing — shared here so the two can't drift apart.
//
// `items` should already be in the order you want units to come out in
// (callers that care about rank sort before calling this).
export function groupUnits(items: ClientEntry[]): EntryUnit[] {
  const seen = new Set<string>();
  const units: EntryUnit[] = [];
  for (const item of items) {
    if (seen.has(item.id)) continue;
    if (item.groupLabel) {
      const partner = items.find(
        (o) => o.id !== item.id && o.groupLabel === item.groupLabel && !seen.has(o.id)
      );
      if (partner) {
        seen.add(item.id);
        seen.add(partner.id);
        units.push({ type: "group", listings: [item, partner] });
        continue;
      }
    }
    seen.add(item.id);
    units.push({ type: "solo", listings: [item] });
  }
  return units;
}
