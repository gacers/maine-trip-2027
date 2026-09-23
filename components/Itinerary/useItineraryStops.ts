import { useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import type { ItineraryStop, ItineraryStopStatus } from "@/lib/types";

export interface UseItineraryStopsArgs {
  tripSlug: string;
  authToken: string | null;
  /** Waits on ItineraryPage's own accessChecked — a contributor's token
   * (only known after that resolves) has to already be in authHeaders
   * by the time this first fires, same reasoning as the old plain-effect
   * version this replaced. */
  enabled: boolean;
}

// The stop list itself and every mutation that touches it — same shape
// as SectionPage's useSectionEntries (a real useQuery, cached by
// tripSlug+authToken, so nav away and back within a session doesn't
// re-fetch from scratch the way a plain per-mount effect did), split
// out of ItineraryPage for the same reason that file's own render logic
// shouldn't be tangled up with the query/cache plumbing.
export function useItineraryStops({ tripSlug, authToken, enabled }: UseItineraryStopsArgs) {
  const queryClient = useQueryClient();
  // Only ever set by a mutation's own catch block below — the stops
  // query's own fetch error surfaces separately, this is just for a
  // patch/delete/move that failed after already being applied
  // optimistically.
  const [mutationError, setMutationError] = useState("");

  function authHeaders(): Record<string, string> {
    return authToken ? { Authorization: `Bearer ${authToken}` } : {};
  }

  const stopsQueryKey = ["itineraryStops", tripSlug, authToken] as const;

  const stopsQuery = useQuery({
    queryKey: stopsQueryKey,
    queryFn: async () => {
      const res = await fetch(`/api/trips/${tripSlug}/itinerary/stops`, { cache: "no-store", headers: authHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't load the itinerary");
      return data.stops as ItineraryStop[];
    },
    enabled,
  });
  const stops = stopsQuery.data ?? [];
  // isPending stays true while `enabled` is still false (accessChecked
  // hasn't resolved yet) or the query itself hasn't settled — same
  // "full spinner only until there's cached data at all" behavior
  // useSectionEntries already relies on.
  const loading = stopsQuery.isPending;
  const error = mutationError || (stopsQuery.isError ? (stopsQuery.error as Error).message : "");

  function setStopsData(updater: (old: ItineraryStop[]) => ItineraryStop[]) {
    queryClient.setQueryData<ItineraryStop[]>(stopsQueryKey, (old) => updater(old ?? []));
  }

  // AddStopDialog/EditStopDialog do their own POST/PATCH/DELETE and hand
  // back the result — these just land it in the same cache the stops
  // query itself reads from, same division of labor as SectionPage's
  // own handleAdded.
  function handleAdded(stop: ItineraryStop) {
    setStopsData((old) => [...old, stop]);
  }

  function handleUpdated(stop: ItineraryStop) {
    setStopsData((old) => old.map((s) => (s.id === stop.id ? stop : s)));
  }

  function handleDeleted(stopId: string) {
    setStopsData((old) => old.filter((s) => s.id !== stopId));
  }

  const statusMutation = useMutation({
    mutationFn: async ({ stopId, status }: { stopId: string; status: ItineraryStopStatus }) => {
      const res = await fetch(`/api/trips/${tripSlug}/itinerary/stops/${stopId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("Update failed");
      return (await res.json()).stop as ItineraryStop;
    },
  });

  // The quick Confirm/Skip checkboxes on a tentative stop's own card —
  // a lighter-weight path than opening the full edit dialog just to
  // flip one field. "Skip" maps to "archived": kept around (dimmed),
  // not deleted, same as the real hand-built reference itinerary kept
  // its own discarded options visible rather than removing them.
  async function handleStatusChange(stopId: string, status: ItineraryStopStatus) {
    const prevStops = stops;
    setStopsData((old) => old.map((s) => (s.id === stopId ? { ...s, status } : s)));
    setMutationError("");
    try {
      const updated = await statusMutation.mutateAsync({ stopId, status });
      handleUpdated(updated);
    } catch {
      setStopsData(() => prevStops);
      setMutationError("Couldn't update that stop's status — try again.");
    }
  }

  const clearAllMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/trips/${tripSlug}/itinerary/stops`, { method: "DELETE", headers: authHeaders() });
      if (!res.ok) throw new Error("Clear failed");
    },
  });

  async function handleClearAll() {
    setMutationError("");
    const prevStops = stops;
    setStopsData(() => []);
    try {
      await clearAllMutation.mutateAsync();
    } catch {
      setStopsData(() => prevStops);
      setMutationError("Couldn't clear the itinerary — try again.");
    }
  }

  // The shared move used by both views — the list view only ever
  // reorders within the same date (targetDate omitted, so the dragged
  // stop's own date is left alone); WeekView also uses this to drag a
  // stop onto a different day's lane entirely (targetDate set), or
  // onto an empty lane / the end of one (targetId omitted — inserts
  // right after that date's own last stop in the flat order, or at the
  // very end if that date has none yet). Every stop's sort_order is
  // one single flat sequence across the whole trip regardless of date
  // — the date grouping (list view's day headers, WeekView's lanes) is
  // purely a display concern on top of it, same as the original
  // itinerary-builder plan called for.
  async function moveStop(draggedId: string, targetId: string | null, position: "before" | "after", targetDate?: string | null) {
    const dragged = stops.find((s) => s.id === draggedId);
    if (!dragged) return;
    if (targetId && draggedId === targetId) return;

    const dateChanged = targetDate !== undefined && targetDate !== dragged.date;
    const updatedDragged = dateChanged ? { ...dragged, date: targetDate! } : dragged;
    const withoutDragged = stops.filter((s) => s.id !== draggedId);

    let insertAt: number;
    if (targetId) {
      insertAt = withoutDragged.findIndex((s) => s.id === targetId);
      if (insertAt === -1) return;
      if (position === "after") insertAt += 1;
    } else if (dateChanged) {
      // No specific target stop — dropped on an empty lane, or past
      // the last card in one. Lands right after that date's own last
      // stop in the flat order (or at the very end if it has none).
      let lastIndexInGroup = -1;
      withoutDragged.forEach((s, i) => {
        if (s.date === targetDate) lastIndexInGroup = i;
      });
      insertAt = lastIndexInGroup === -1 ? withoutDragged.length : lastIndexInGroup + 1;
    } else {
      return;
    }

    const reordered = [...withoutDragged];
    reordered.splice(insertAt, 0, updatedDragged);
    const prevStops = stops;
    setStopsData(() => reordered);

    // Only whatever's own position (or, for the dragged stop, date)
    // actually changed — a drag near either end of a long itinerary
    // used to still PATCH every single stop, since it just re-sent
    // every index unconditionally.
    const originalIndex = new Map(prevStops.map((s, i) => [s.id, i]));
    const toSave = reordered
      .map((s, i) => ({ s, i }))
      .filter(({ s, i }) => originalIndex.get(s.id) !== i || (dateChanged && s.id === draggedId));

    setMutationError("");
    try {
      await Promise.all(
        toSave.map(({ s, i }) =>
          fetch(`/api/trips/${tripSlug}/itinerary/stops/${s.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json", ...authHeaders() },
            body: JSON.stringify(dateChanged && s.id === draggedId ? { sortOrder: i, date: targetDate } : { sortOrder: i }),
          })
        )
      );
    } catch {
      setMutationError("Move failed to save — reload to see the actual saved order.");
      queryClient.invalidateQueries({ queryKey: stopsQueryKey });
    }
  }

  return {
    stops,
    loading,
    error,
    handleAdded,
    handleUpdated,
    handleDeleted,
    handleStatusChange,
    handleClearAll,
    moveStop,
  };
}
