import type { ItineraryStop } from "@/lib/types";

export interface DateLane {
  /** null is the "Unscheduled" lane — always last, since it's not a
   * day of the trip, just a holding pen for stops that haven't been
   * pinned to one yet. */
  date: string | null;
  stops: ItineraryStop[];
}

// Groups the same flat, globally-ordered stop list the list view uses
// into one lane per distinct date — for WeekView's own swim-lane
// columns. Order within each lane preserves the stops' own relative
// sort_order (they're already sorted coming in); lane order is
// ascending by date, with the null ("Unscheduled") lane always last
// regardless of where its stops actually fall in the global order.
export function groupStopsByDate(stops: ItineraryStop[]): DateLane[] {
  const byDate = new Map<string | null, ItineraryStop[]>();
  for (const stop of stops) {
    const key = stop.date;
    if (!byDate.has(key)) byDate.set(key, []);
    byDate.get(key)!.push(stop);
  }

  const dated = [...byDate.entries()]
    .filter(([date]) => date !== null)
    .sort(([a], [b]) => (a! < b! ? -1 : a! > b! ? 1 : 0))
    .map(([date, dateStops]) => ({ date, stops: dateStops }));

  const unscheduled = byDate.get(null);
  return unscheduled ? [...dated, { date: null, stops: unscheduled }] : dated;
}
