"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import classNames from "classnames";
import { captureInviteToken } from "@/lib/inviteClient";
import AddStopDialog from "./AddStopDialog";
import EditStopDialog from "./EditStopDialog";
import DocExportBox from "./DocExportBox";
import WeekView from "./WeekView";
import EmptyState from "@/components/EmptyState";
import { useItineraryStops } from "./useItineraryStops";
import type { PublicTrip, ItineraryStop } from "@/lib/types";
import styles from "./ItineraryPage.module.css";

export interface ItineraryPageProps {
  trip: PublicTrip;
  isAdmin: boolean;
  isEditor: boolean;
}

// The trip's day-by-day plan — one lane per day (see WeekView), grouped
// by date, with a computed drive-time connector between any two
// consecutive stops that both have coordinates. A flat, drag-reorderable
// list-view rendering (plus its own drag state) used to live here too,
// behind a viewMode toggle nothing ever actually reached — dropped
// entirely once that made it permanently dead code; see git history if
// list view is ever worth reviving. The stop list itself and its
// mutations live in useItineraryStops, split out the same way
// SectionPage's own entries are.
export default function ItineraryPage({ trip, isAdmin, isEditor }: ItineraryPageProps) {
  const [contributorToken, setContributorToken] = useState<string | null>(null);
  const [accessChecked, setAccessChecked] = useState(isAdmin || isEditor);
  const [editingStop, setEditingStop] = useState<ItineraryStop | null>(null);
  const stickyHeaderRef = useRef<HTMLDivElement>(null);

  const canContribute = isAdmin || isEditor || !!contributorToken;
  const authToken = isAdmin || isEditor ? null : contributorToken;

  useEffect(() => {
    setContributorToken(captureInviteToken(trip.slug));
    setAccessChecked(true);
  }, [trip.slug]);

  const { stops, loading, error, handleAdded, handleUpdated, handleDeleted, handleStatusChange, handleClearAll, moveStop } =
    useItineraryStops({ tripSlug: trip.slug, authToken, enabled: accessChecked });

  // This page's own sticky bar (title/toggle/actions row, plus the Doc
  // export box) sits right below the site's own sticky nav — its
  // rendered height varies (the export box only shows once
  // accessChecked, and wraps taller on a narrow screen), so it's
  // published as a CSS variable on the document root the same way
  // TripNavHeader publishes --sticky-nav-height, rather than guessed
  // as a fixed value. Lets WeekView's own per-lane sticky day headers
  // stick directly below both stacked bars instead of getting covered
  // by them (a sibling, not a descendant, of this bar in the DOM, so
  // the variable has to live somewhere both can reach).
  useLayoutEffect(() => {
    const el = stickyHeaderRef.current;
    if (!el) return;
    const setHeight = () => document.documentElement.style.setProperty("--itinerary-sticky-header-height", `${el.offsetHeight}px`);
    setHeight();
    const observer = new ResizeObserver(setHeight);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  async function handleClearAllConfirmed() {
    if (!window.confirm(`Remove all ${stops.length} stops from this itinerary? This can't be undone.`)) return;
    await handleClearAll();
  }

  return (
    <div className={classNames(styles["root"], styles["root-week"])}>
      <div ref={stickyHeaderRef} className={styles["sticky-header"]}>
        <div className={styles["header"]}>
          {accessChecked && canContribute && (
            <div className={styles["header-actions"]}>
              <AddStopDialog
                tripSlug={trip.slug}
                authToken={authToken}
                lastStop={stops.length > 0 ? stops[stops.length - 1] : null}
                onAdded={handleAdded}
              />
              {stops.length > 0 && (
                <button type="button" onClick={handleClearAllConfirmed} className={styles["clear-button"]}>
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
        <EmptyState busy />
      ) : (
        <div className="page-fade-in">
          {stops.length === 0 ? (
            <EmptyState>Nothing on the itinerary yet</EmptyState>
          ) : (
            <WeekView
              stops={stops}
              tripSlug={trip.slug}
              authToken={authToken}
              canContribute={canContribute}
              onEdit={setEditingStop}
              onMoveStop={moveStop}
              onAdded={handleAdded}
              onStatusChange={handleStatusChange}
            />
          )}
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
