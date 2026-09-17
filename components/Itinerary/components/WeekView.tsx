"use client";

import { useRef, useState, type DragEvent } from "react";
import classNames from "classnames";
import StopCard from "./StopCard";
import RouteConnector from "./RouteConnector";
import AddStopDialog from "./AddStopDialog";
import { groupStopsByDate } from "../lib/groupStopsByDate";
import type { ItineraryStop } from "@/lib/types";
import styles from "./WeekView.module.css";

export interface WeekViewProps {
  stops: ItineraryStop[];
  tripSlug: string;
  authToken: string | null;
  canContribute: boolean;
  onEdit: (stop: ItineraryStop) => void;
  onMoveStop: (draggedId: string, targetId: string | null, position: "before" | "after", targetDate?: string | null) => void;
  onAdded: (stop: ItineraryStop) => void;
}

function formatLaneHeader(date: string | null): string {
  if (!date) return "Unscheduled";
  const d = new Date(`${date}T00:00:00`);
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

function laneKey(date: string | null): string {
  return date ?? "__unscheduled__";
}

// One column ("lane") per day the itinerary actually touches — not a
// literal Sun-Sat calendar grid (a trip rarely starts on a Sunday, and
// that would leave awkward empty lanes on both ends); a lane per date
// that has stops on it, in date order, plus one final "Unscheduled"
// lane for anything with no date yet. Same drag-to-reorder as the list
// view (see ItineraryPage's own moveStop), extended to dragging a stop
// onto a *different* lane entirely, which reassigns its date. On
// narrow screens the lane row becomes a snap-scrolling carousel (CSS
// scroll-snap, not JS-tracked "current page" state) — one lane fills
// the viewport at a time, with a day-picker strip above it to jump
// straight to one instead of swiping through everything between.
export default function WeekView({ stops, tripSlug, authToken, canContribute, onEdit, onMoveStop, onAdded }: WeekViewProps) {
  const lanes = groupStopsByDate(stops);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [dropPosition, setDropPosition] = useState<"before" | "after">("before");
  const [dragOverLane, setDragOverLane] = useState<string | null>(null);
  const lanesRef = useRef<HTMLDivElement>(null);
  const laneRefs = useRef(new Map<string, HTMLDivElement>());

  function scrollToLane(key: string) {
    laneRefs.current.get(key)?.scrollIntoView({ behavior: "smooth", inline: "start", block: "nearest" });
  }

  return (
    <div className={styles["root"]}>
      <div className={styles["day-picker"]}>
        {lanes.map((lane) => (
          <button key={laneKey(lane.date)} type="button" onClick={() => scrollToLane(laneKey(lane.date))} className={styles["day-pill"]}>
            {formatLaneHeader(lane.date)}
          </button>
        ))}
      </div>

      <div className={styles["lanes"]} ref={lanesRef}>
        {lanes.map((lane) => {
          const key = laneKey(lane.date);
          return (
            <div
              key={key}
              ref={(el) => {
                if (el) laneRefs.current.set(key, el);
                else laneRefs.current.delete(key);
              }}
              className={classNames(styles["lane"], dragOverLane === key && styles["lane-drop-target"])}
              onDragOver={(e: DragEvent) => {
                if (!draggingId) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                setDragOverLane(key);
              }}
              onDragLeave={(e: DragEvent) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
                  setDragOverLane((k) => (k === key ? null : k));
                }
              }}
              onDrop={(e: DragEvent) => {
                e.preventDefault();
                // Only fires when dropped on the lane's own empty space
                // (past every card) — dropping directly on a card is
                // handled by that card's own onDrop below instead,
                // which still bubbles here otherwise.
                if (draggingId && dragOverId == null) onMoveStop(draggingId, null, "after", lane.date);
                setDraggingId(null);
                setDragOverId(null);
                setDragOverLane(null);
              }}
            >
              <h2 className={styles["lane-header"]}>{formatLaneHeader(lane.date)}</h2>
              {lane.stops.length === 0 ? (
                <p className={styles["lane-empty"]}>Drag a stop here</p>
              ) : (
                lane.stops.map((stop, i) => {
                  const prevStop = i > 0 ? lane.stops[i - 1] : null;
                  const showConnector =
                    prevStop != null && prevStop.lat != null && prevStop.lng != null && stop.lat != null && stop.lng != null;

                  return (
                    <div key={stop.id}>
                      {showConnector && (
                        <RouteConnector
                          tripSlug={tripSlug}
                          authToken={authToken}
                          from={{ lat: prevStop!.lat!, lng: prevStop!.lng! }}
                          to={{ lat: stop.lat!, lng: stop.lng! }}
                          travelMode={stop.travel_mode}
                          toDate={stop.date}
                          toTime={stop.time}
                        />
                      )}
                      <StopCard
                        stop={stop}
                        tripSlug={tripSlug}
                        canEdit={canContribute}
                        onEdit={() => onEdit(stop)}
                        dragging={draggingId === stop.id}
                        dropBefore={dragOverId === stop.id && dropPosition === "before"}
                        dropAfter={dragOverId === stop.id && dropPosition === "after"}
                        onDragStart={(e: DragEvent) => {
                          e.dataTransfer.setData("text/plain", stop.id);
                          e.dataTransfer.effectAllowed = "move";
                          setDraggingId(stop.id);
                        }}
                        onDragOver={(e: DragEvent) => {
                          if (!draggingId || draggingId === stop.id) return;
                          e.preventDefault();
                          e.stopPropagation();
                          e.dataTransfer.dropEffect = "move";
                          setDragOverLane(key);
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
                          e.stopPropagation();
                          if (draggingId) onMoveStop(draggingId, stop.id, dropPosition, lane.date);
                          setDraggingId(null);
                          setDragOverId(null);
                          setDragOverLane(null);
                        }}
                        onDragEnd={() => {
                          setDraggingId(null);
                          setDragOverId(null);
                          setDragOverLane(null);
                        }}
                      />
                    </div>
                  );
                })
              )}
              {canContribute && (
                <AddStopDialog
                  tripSlug={tripSlug}
                  authToken={authToken}
                  lastStop={lane.stops.length > 0 ? lane.stops[lane.stops.length - 1] : null}
                  presetDate={lane.date}
                  triggerVariant="ghost"
                  onAdded={onAdded}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
