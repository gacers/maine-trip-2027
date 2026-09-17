"use client";

import { useEffect, useState, type DragEvent } from "react";
import classNames from "classnames";
import { captureInviteToken } from "@/lib/inviteClient";
import AddStopDialog from "./components/AddStopDialog";
import EditStopDialog from "./components/EditStopDialog";
import StopCard from "./components/StopCard";
import RouteConnector from "./components/RouteConnector";
import DocExportBox from "./components/DocExportBox";
import WeekView from "./components/WeekView";
import type { PublicTrip, ItineraryStop } from "@/lib/types";
import styles from "./ItineraryPage.module.css";

type ViewMode = "list" | "week";

export interface ItineraryPageProps {
  trip: PublicTrip;
  isAdmin: boolean;
  isEditor: boolean;
}

function formatDayHeader(date: string | null): string {
  if (!date) return "Unscheduled";
  const d = new Date(`${date}T00:00:00`);
  return d.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
}

// The trip's day-by-day plan — a flat, drag-reorderable list of stops
// (see lib/itineraryStops.ts), grouped into day headers wherever the
// date changes as you scan down the list (a display grouping, not a
// separate ordering dimension — see the itinerary-builder plan) with a
// computed drive-time connector between any two consecutive stops that
// both have coordinates.
export default function ItineraryPage({ trip, isAdmin, isEditor }: ItineraryPageProps) {
  const [stops, setStops] = useState<ItineraryStop[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [contributorToken, setContributorToken] = useState<string | null>(null);
  const [accessChecked, setAccessChecked] = useState(isAdmin || isEditor);
  const [editingStop, setEditingStop] = useState<ItineraryStop | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("list");

  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [dropPosition, setDropPosition] = useState<"before" | "after">("before");

  const canContribute = isAdmin || isEditor || !!contributorToken;
  const authToken = isAdmin || isEditor ? null : contributorToken;
  const authHeaders: Record<string, string> = authToken ? { Authorization: `Bearer ${authToken}` } : {};

  useEffect(() => {
    setContributorToken(captureInviteToken(trip.slug));
    setAccessChecked(true);
  }, [trip.slug]);

  useEffect(() => {
    // Waits on accessChecked so a contributor's token (only known after
    // the effect above resolves) is actually in authHeaders by the time
    // this fires — otherwise a contributor's very first render would
    // fire this with no Authorization header and get refused.
    if (!accessChecked) return;
    fetch(`/api/trips/${trip.slug}/itinerary/stops`, { cache: "no-store", headers: authHeaders })
      .then((res) => res.json())
      .then((data) => setStops(data.stops || []))
      .catch(() => setError("Couldn't load the itinerary"))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trip.slug, accessChecked]);

  function canReorder(draggedId: string, targetId: string): boolean {
    return draggedId !== targetId && stops.some((s) => s.id === draggedId) && stops.some((s) => s.id === targetId);
  }

  async function reorderStops(draggedId: string, targetId: string, position: "before" | "after") {
    if (draggedId === targetId) return;
    await moveStop(draggedId, targetId, position);
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
    setStops(reordered);

    setError("");
    try {
      await Promise.all(
        reordered.map((s, i) =>
          fetch(`/api/trips/${trip.slug}/itinerary/stops/${s.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json", ...authHeaders },
            body: JSON.stringify(dateChanged && s.id === draggedId ? { sortOrder: i, date: targetDate } : { sortOrder: i }),
          })
        )
      );
    } catch {
      setError("Move failed to save — reload to see the actual saved order.");
    }
  }

  function handleAdded(stop: ItineraryStop) {
    setStops((prev) => [...prev, stop]);
  }

  function handleUpdated(stop: ItineraryStop) {
    setStops((prev) => prev.map((s) => (s.id === stop.id ? stop : s)));
  }

  function handleDeleted(stopId: string) {
    setStops((prev) => prev.filter((s) => s.id !== stopId));
  }

  async function handleClearAll() {
    if (!window.confirm(`Remove all ${stops.length} stops from this itinerary? This can't be undone.`)) return;
    setError("");
    try {
      const res = await fetch(`/api/trips/${trip.slug}/itinerary/stops`, {
        method: "DELETE",
        headers: authHeaders,
      });
      if (!res.ok) throw new Error("Clear failed");
      setStops([]);
    } catch {
      setError("Couldn't clear the itinerary — try again.");
    }
  }

  return (
    <div className={styles["root"]}>
      <div className={styles["sticky-header"]}>
        <div className={styles["header"]}>
          <div className={styles["heading-group"]}>
            <h1 className={styles["heading"]}>Itinerary</h1>
            <div className={styles["view-toggle"]}>
              <button
                type="button"
                onClick={() => setViewMode("list")}
                className={classNames(styles["view-toggle-button"], viewMode === "list" && styles["view-toggle-active"])}
              >
                List
              </button>
              <button
                type="button"
                onClick={() => setViewMode("week")}
                className={classNames(styles["view-toggle-button"], viewMode === "week" && styles["view-toggle-active"])}
              >
                Week
              </button>
            </div>
          </div>
          {accessChecked && canContribute && (
            <div className={styles["header-actions"]}>
              <AddStopDialog
                tripSlug={trip.slug}
                authToken={authToken}
                lastStop={stops.length > 0 ? stops[stops.length - 1] : null}
                onAdded={handleAdded}
              />
              {stops.length > 0 && (
                <button type="button" onClick={handleClearAll} className={styles["clear-button"]}>
                  Clear all
                </button>
              )}
            </div>
          )}
        </div>

        {accessChecked && canContribute && <DocExportBox tripSlug={trip.slug} authToken={authToken} />}
      </div>

      {error && <p className={styles["error"]}>{error}</p>}

      {loading ? (
        <p className={styles["muted"]}>Loading...</p>
      ) : stops.length === 0 ? (
        <p className={styles["muted"]}>Nothing on the itinerary yet — add a stop above.</p>
      ) : viewMode === "week" ? (
        <WeekView
          stops={stops}
          tripSlug={trip.slug}
          authToken={authToken}
          canContribute={canContribute}
          onEdit={setEditingStop}
          onMoveStop={moveStop}
        />
      ) : (
        <div className={styles["list"]}>
          {stops.map((stop, i) => {
            const prevStop = i > 0 ? stops[i - 1] : null;
            const showDayHeader = i === 0 || prevStop?.date !== stop.date;
            const showConnector =
              prevStop != null && prevStop.lat != null && prevStop.lng != null && stop.lat != null && stop.lng != null;

            return (
              <div key={stop.id}>
                {showConnector && (
                  <RouteConnector
                    tripSlug={trip.slug}
                    authToken={authToken}
                    from={{ lat: prevStop!.lat!, lng: prevStop!.lng! }}
                    to={{ lat: stop.lat!, lng: stop.lng! }}
                    travelMode={stop.travel_mode}
                    toDate={stop.date}
                    toTime={stop.time}
                  />
                )}
                {showDayHeader && <h2 className={styles["day-header"]}>{formatDayHeader(stop.date)}</h2>}
                <StopCard
                  stop={stop}
                  tripSlug={trip.slug}
                  canEdit={canContribute}
                  onEdit={() => setEditingStop(stop)}
                  dragging={draggingId === stop.id}
                  dropBefore={dragOverId === stop.id && dropPosition === "before"}
                  dropAfter={dragOverId === stop.id && dropPosition === "after"}
                  onDragStart={(e: DragEvent) => {
                    e.dataTransfer.setData("text/plain", stop.id);
                    e.dataTransfer.effectAllowed = "move";
                    setDraggingId(stop.id);
                  }}
                  onDragOver={(e: DragEvent) => {
                    if (!draggingId || !canReorder(draggingId, stop.id)) return;
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "move";
                    const rect = e.currentTarget.getBoundingClientRect();
                    setDragOverId(stop.id);
                    setDropPosition(e.clientY > rect.top + rect.height / 2 ? "after" : "before");
                  }}
                  onDragLeave={(e: DragEvent) => {
                    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
                      setDragOverId((id) => (id === stop.id ? null : id));
                    }
                  }}
                  onDrop={(e: DragEvent) => {
                    e.preventDefault();
                    if (draggingId) reorderStops(draggingId, stop.id, dropPosition);
                    setDraggingId(null);
                    setDragOverId(null);
                  }}
                  onDragEnd={() => {
                    setDraggingId(null);
                    setDragOverId(null);
                  }}
                />
              </div>
            );
          })}
        </div>
      )}

      {editingStop && (
        <EditStopDialog
          tripSlug={trip.slug}
          authToken={authToken}
          stop={editingStop}
          previousStop={(() => {
            const i = stops.findIndex((s) => s.id === editingStop.id);
            return i > 0 ? stops[i - 1] : null;
          })()}
          open={!!editingStop}
          onOpenChange={(open) => !open && setEditingStop(null)}
          onUpdated={handleUpdated}
          onDeleted={handleDeleted}
        />
      )}
    </div>
  );
}
