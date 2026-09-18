"use client";

import { useLayoutEffect, useRef, useState, type DragEvent } from "react";
import classNames from "classnames";
import StopCard from "./StopCard";
import RouteConnector from "./RouteConnector";
import AddStopDialog from "./AddStopDialog";
import { groupStopsByDate } from "../lib/groupStopsByDate";
import type { ItineraryStop, ItineraryStopStatus } from "@/lib/types";
import styles from "./WeekView.module.css";

export interface WeekViewProps {
  stops: ItineraryStop[];
  tripSlug: string;
  authToken: string | null;
  canContribute: boolean;
  onEdit: (stop: ItineraryStop) => void;
  onMoveStop: (draggedId: string, targetId: string | null, position: "before" | "after", targetDate?: string | null) => void;
  onAdded: (stop: ItineraryStop) => void;
  onStatusChange: (stopId: string, status: ItineraryStopStatus) => void;
}

function formatLaneHeader(date: string | null): string {
  if (!date) return "Unscheduled";
  const d = new Date(`${date}T00:00:00`);
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

function laneKey(date: string | null): string {
  return date ?? "__unscheduled__";
}

interface StuckInfo {
  left: number;
  width: number;
  height: number;
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
export default function WeekView({
  stops,
  tripSlug,
  authToken,
  canContribute,
  onEdit,
  onMoveStop,
  onAdded,
  onStatusChange,
}: WeekViewProps) {
  const lanes = groupStopsByDate(stops);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [dropPosition, setDropPosition] = useState<"before" | "after">("before");
  const [dragOverLane, setDragOverLane] = useState<string | null>(null);
  const lanesRef = useRef<HTMLDivElement>(null);
  const dayPickerRef = useRef<HTMLDivElement>(null);
  const laneRefs = useRef(new Map<string, HTMLDivElement>());
  const headerRefs = useRef(new Map<string, HTMLHeadingElement>());

  // A per-lane "pinned to the top of THIS column" header, without the
  // whole page's own scroll changing at all — real CSS position:sticky
  // can't do this here (tried twice — see the old comments still in
  // git history): .lanes needs overflow-x:auto for the horizontal
  // scroll, and per spec that forces its overflow-y to compute to
  // "auto" too, which silently makes .lanes — not the page — the
  // nearest scrolling ancestor a descendant's position:sticky resolves
  // against, breaking it outright rather than just not sticking.
  // Bounding each lane's own height to make that container's overflow
  // "real" fixed the CSS problem but introduced a worse one (reported
  // live): a nested independently-scrolling column fights a normal
  // trackpad/mobile scroll gesture instead of just scrolling the page.
  // This reimplements sticky by hand instead — measuring positions on
  // scroll/resize and switching a lane's own header to position:fixed
  // (with a same-height placeholder left behind so nothing jumps)
  // exactly while that lane's own vertical span crosses the sticky
  // bars above, and only while it's actually within .lanes' own
  // horizontally-scrolled viewport (otherwise a "stuck" header would
  // float past the edge of the lanes row, unclipped by its own
  // overflow, since position:fixed escapes that).
  const [stuck, setStuck] = useState<Record<string, StuckInfo | undefined>>({});
  const [stickTop, setStickTop] = useState(0);

  useLayoutEffect(() => {
    let raf: number | null = null;

    function recompute() {
      const newStickTop = dayPickerRef.current?.getBoundingClientRect().bottom ?? 0;
      const lanesRect = lanesRef.current?.getBoundingClientRect();

      // The comparison against "what was stuck before" has to happen
      // INSIDE setStuck's own updater, reading its own prevStuck
      // argument — not the `stuck` variable from this closure. This
      // effect only re-runs when lanes.length changes (see its own
      // deps), so a `stuck` read from the outer scope stays frozen at
      // whatever it was on that last run, not the actual current
      // value after any of the setStuck calls a scroll/resize already
      // triggered since. Confirmed live as the actual bug behind
      // headers not un-sticking at the right point: once ANY lane was
      // stuck, prevStuck[key] was always the ORIGINAL (empty) object,
      // so "just this lane un-stuck and nothing else did" produced
      // no signal to actually update React's state at all.
      setStuck((prevStuck) => {
        const next: Record<string, StuckInfo | undefined> = {};
        let changed = false;

        for (const [key, laneEl] of laneRefs.current) {
          const laneRect = laneEl.getBoundingClientRect();
          const headerEl = headerRefs.current.get(key);
          const headerHeight = headerEl?.getBoundingClientRect().height ?? 0;
          const horizontallyVisible = !lanesRect || (laneRect.right > lanesRect.left && laneRect.left < lanesRect.right);
          const isStuck = horizontallyVisible && laneRect.top < newStickTop && laneRect.bottom > newStickTop + headerHeight;

          if (isStuck) {
            // Derived from .lane's own box + its real computed
            // padding, not the header element's own rect — once the
            // header itself is position:fixed, its own rect just
            // reflects whatever we last told it to be, which would
            // turn this into a feedback loop (reading back exactly
            // what was set, never correcting toward .lane's actual
            // current position) instead of an honest recomputation
            // each time.
            const laneStyle = window.getComputedStyle(laneEl);
            const paddingLeft = parseFloat(laneStyle.paddingLeft) || 0;
            const paddingRight = parseFloat(laneStyle.paddingRight) || 0;
            const info: StuckInfo = {
              left: laneRect.left + paddingLeft,
              width: laneRect.width - paddingLeft - paddingRight,
              height: headerHeight,
            };
            next[key] = info;
            const prev = prevStuck[key];
            if (!prev || prev.left !== info.left || prev.width !== info.width || prev.height !== info.height) changed = true;
          } else if (prevStuck[key]) {
            changed = true;
          }
        }

        return changed ? next : prevStuck;
      });
      setStickTop((prevTop) => (prevTop === newStickTop ? prevTop : newStickTop));
    }

    function onScrollOrResize() {
      if (raf != null) return;
      raf = requestAnimationFrame(() => {
        raf = null;
        recompute();
      });
    }

    recompute();
    window.addEventListener("scroll", onScrollOrResize, { passive: true });
    window.addEventListener("resize", onScrollOrResize);
    const lanesEl = lanesRef.current;
    lanesEl?.addEventListener("scroll", onScrollOrResize, { passive: true });
    const resizeObserver = new ResizeObserver(onScrollOrResize);
    if (lanesEl) resizeObserver.observe(lanesEl);

    return () => {
      window.removeEventListener("scroll", onScrollOrResize);
      window.removeEventListener("resize", onScrollOrResize);
      lanesEl?.removeEventListener("scroll", onScrollOrResize);
      resizeObserver.disconnect();
      if (raf != null) cancelAnimationFrame(raf);
    };
  }, [lanes.length]);

  function scrollToLane(key: string) {
    // block: "nearest" was the culprit behind a mobile tap landing
    // partway down the page instead of at the lane's own top — a
    // full-height lane (many stops) counts as "already visible" the
    // moment ANY part of it is on screen, so "nearest" often left the
    // page scrolled to wherever it already happened to be rather than
    // jumping to this lane's start. "start" always aligns the lane's
    // own top edge to the top of the scrollable area (offset by
    // .lane's own scroll-margin-top so the page's sticky bars don't
    // cover it).
    laneRefs.current.get(key)?.scrollIntoView({ behavior: "smooth", inline: "start", block: "start" });
  }

  return (
    <div className={styles["root"]}>
      <div className={styles["day-picker"]} ref={dayPickerRef}>
        {lanes.map((lane) => (
          <button key={laneKey(lane.date)} type="button" onClick={() => scrollToLane(laneKey(lane.date))} className={styles["day-pill"]}>
            {formatLaneHeader(lane.date)}
          </button>
        ))}
      </div>

      <div className={styles["lanes"]} ref={lanesRef}>
        {lanes.map((lane) => {
          const key = laneKey(lane.date);
          const stuckInfo = stuck[key];
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
              {stuckInfo && <div style={{ height: stuckInfo.height }} aria-hidden />}
              <h2
                ref={(el) => {
                  if (el) headerRefs.current.set(key, el);
                  else headerRefs.current.delete(key);
                }}
                className={styles["lane-header"]}
                style={
                  stuckInfo
                    ? { position: "fixed", top: stickTop, left: stuckInfo.left, width: stuckInfo.width }
                    : undefined
                }
              >
                {formatLaneHeader(lane.date)}
              </h2>
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
                        onStatusChange={(status) => onStatusChange(stop.id, status)}
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
