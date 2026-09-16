"use client";

import { useEffect, useState, type DragEvent } from "react";
import { captureInviteToken } from "@/lib/inviteClient";
import AddStopDialog from "./components/AddStopDialog";
import EditStopDialog from "./components/EditStopDialog";
import StopCard from "./components/StopCard";
import RouteConnector from "./components/RouteConnector";
import type { PublicTrip, ItineraryStop } from "@/lib/types";
import styles from "./ItineraryPage.module.css";

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
    fetch(`/api/trips/${trip.slug}/itinerary/stops`, { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => setStops(data.stops || []))
      .catch(() => setError("Couldn't load the itinerary"))
      .finally(() => setLoading(false));
  }, [trip.slug]);

  function canReorder(draggedId: string, targetId: string): boolean {
    return draggedId !== targetId && stops.some((s) => s.id === draggedId) && stops.some((s) => s.id === targetId);
  }

  async function reorderStops(draggedId: string, targetId: string, position: "before" | "after") {
    if (draggedId === targetId) return;
    const ids = stops.map((s) => s.id);
    const fromIndex = ids.indexOf(draggedId);
    if (fromIndex === -1 || ids.indexOf(targetId) === -1) return;

    const reordered = [...stops];
    const [moved] = reordered.splice(fromIndex, 1);
    let insertAt = reordered.findIndex((s) => s.id === targetId);
    if (position === "after") insertAt += 1;
    reordered.splice(insertAt, 0, moved);
    setStops(reordered);

    setError("");
    try {
      await Promise.all(
        reordered.map((s, i) =>
          fetch(`/api/trips/${trip.slug}/itinerary/stops/${s.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json", ...authHeaders },
            body: JSON.stringify({ sortOrder: i }),
          })
        )
      );
    } catch {
      setError("Reorder failed to save — reload to see the actual saved order.");
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

  return (
    <div className={styles["root"]}>
      <div className={styles["header"]}>
        <h1 className={styles["heading"]}>Itinerary</h1>
        {accessChecked && canContribute && (
          <AddStopDialog
            tripSlug={trip.slug}
            authToken={authToken}
            lastStop={stops.length > 0 ? stops[stops.length - 1] : null}
            onAdded={handleAdded}
          />
        )}
      </div>

      {error && <p className={styles["error"]}>{error}</p>}

      {loading ? (
        <p className={styles["muted"]}>Loading...</p>
      ) : stops.length === 0 ? (
        <p className={styles["muted"]}>Nothing on the itinerary yet — add a stop above.</p>
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
                    from={{ lat: prevStop!.lat!, lng: prevStop!.lng! }}
                    to={{ lat: stop.lat!, lng: stop.lng! }}
                    travelMode={stop.travel_mode}
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
          open={!!editingStop}
          onOpenChange={(open) => !open && setEditingStop(null)}
          onUpdated={handleUpdated}
          onDeleted={handleDeleted}
        />
      )}
    </div>
  );
}
