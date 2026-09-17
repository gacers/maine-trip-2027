"use client";

import type { DragEvent } from "react";
import classNames from "classnames";
import Link from "next/link";
import { formatDuration } from "@/lib/formatDuration";
import type { ItineraryStop, ItineraryStopStatus } from "@/lib/types";
import styles from "./StopCard.module.css";

export interface StopCardProps {
  stop: ItineraryStop;
  tripSlug: string;
  canEdit: boolean;
  onEdit: () => void;
  /** Only ever called with "confirmed" or "archived" — the two quick
   * actions a tentative stop's own Confirm/Skip checkboxes offer. */
  onStatusChange: (status: ItineraryStopStatus) => void;
  dragging: boolean;
  dropBefore: boolean;
  dropAfter: boolean;
  onDragStart: (e: DragEvent) => void;
  onDragOver: (e: DragEvent) => void;
  onDragLeave: (e: DragEvent) => void;
  onDrop: (e: DragEvent) => void;
  onDragEnd: () => void;
}

const KIND_LABEL: Record<string, string> = {
  lodging: "Lodging",
  activity: "Activity",
  meal: "Meal",
  bar: "Bar",
  transport: "Transport",
  other: "Other",
};

function formatTime(time: string | null): string | null {
  if (!time) return null;
  const [h, m] = time.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 || 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${period}`;
}

// One stop's card — dimmed for tentative/archived (kept visible, not
// hidden, matching how a real hand-built itinerary keeps discarded
// options around rather than deleting them), a checkmark for
// confirmed. Drag state/handlers are owned by ItineraryPage (the same
// list-wide reorder this session already built for SectionsAdmin);
// this component just renders whatever state it's told.
export default function StopCard({
  stop,
  tripSlug,
  canEdit,
  onEdit,
  onStatusChange,
  dragging,
  dropBefore,
  dropAfter,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragEnd,
}: StopCardProps) {
  const time = formatTime(stop.time);
  const href =
    stop.entry_id && stop.entryNavGroupSlug && stop.entrySectionSlug
      ? `/${tripSlug}/${stop.entryNavGroupSlug}/${stop.entrySectionSlug}#listing-${stop.entry_id}`
      : stop.url;

  return (
    <div
      draggable={canEdit}
      onDragStart={canEdit ? onDragStart : undefined}
      onDragOver={canEdit ? onDragOver : undefined}
      onDragLeave={canEdit ? onDragLeave : undefined}
      onDrop={canEdit ? onDrop : undefined}
      onDragEnd={canEdit ? onDragEnd : undefined}
      className={classNames(
        styles["card"],
        !canEdit && styles["not-draggable"],
        stop.status !== "confirmed" && styles["dimmed"],
        dragging && styles["dragging"],
        dropBefore && styles["drop-before"],
        dropAfter && styles["drop-after"]
      )}
    >
      <div className={styles["main"]}>
        <div className={styles["top-row"]}>
          {time && <span className={styles["time"]}>{time}</span>}
          <span className={styles["kind"]}>{KIND_LABEL[stop.kind] || stop.kind}</span>
          {canEdit ? (
            // Always visible, on every stop regardless of its current
            // status — not just while tentative — so it doubles as
            // both the quick decide-now action AND the always-on
            // indicator of where a stop currently stands. Checking one
            // sets that status; un-checking (clicking an already-
            // checked box) reverts back to tentative, same as any
            // other checkbox toggling its own state.
            <div className={styles["status-actions"]}>
              <label className={styles["status-checkbox"]}>
                <input
                  type="checkbox"
                  checked={stop.status === "confirmed"}
                  onChange={() => onStatusChange(stop.status === "confirmed" ? "tentative" : "confirmed")}
                />
                Confirm
              </label>
              <label className={styles["status-checkbox"]}>
                <input
                  type="checkbox"
                  checked={stop.status === "archived"}
                  onChange={() => onStatusChange(stop.status === "archived" ? "tentative" : "archived")}
                />
                Skip
              </label>
            </div>
          ) : (
            <>
              {stop.status === "confirmed" && (
                <span className={styles["confirmed"]} title="Confirmed / booked">
                  ✅
                </span>
              )}
              {stop.status === "archived" && <span className={styles["archived-tag"]}>Archived</span>}
            </>
          )}
        </div>
        <div className={styles["title"]}>
          {href ? (
            href.startsWith("/") ? (
              <Link href={href}>{stop.title}</Link>
            ) : (
              <a href={href} target="_blank" rel="noopener noreferrer">
                {stop.title}
              </a>
            )
          ) : (
            stop.title
          )}
        </div>
        {stop.duration_minutes != null && <div className={styles["duration"]}>{formatDuration(stop.duration_minutes)}</div>}
        {stop.notes && <div className={styles["notes"]}>{stop.notes}</div>}
      </div>
      {canEdit && (
        <button type="button" onClick={onEdit} className={styles["edit-button"]}>
          Edit
        </button>
      )}
    </div>
  );
}
