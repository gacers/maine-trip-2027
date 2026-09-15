"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/Dialog";
import Button from "@/components/Button";
import type { PublicTrip, NavGroup } from "@/lib/types";
import styles from "./ArchiveUnvisitedButton.module.css";

export interface ArchiveUnvisitedButtonProps {
  trip: PublicTrip;
  /** Every nav group/section, not just the enabled ones TripNavHeader
   * itself renders — an archive sweep should still reach a disabled
   * section, and this is also what tells the query cache exactly which
   * entries-query keys to invalidate afterward. */
  nav: NavGroup[];
  triggerClassName?: string;
}

interface SectionCount {
  navGroupSlug: string;
  sectionLabel: string;
  toArchive: number;
}

interface PreviewState {
  counts: SectionCount[];
  totalArchived: number;
}

// Admin-only, deliberately a separate explicit action from the
// Completed checkbox itself (see TripSettingsForm) rather than
// something that fires the moment Completed is saved — nothing gets
// archived by a stray click before there's been a chance to check off
// what was actually stayed at/visited (see EntryCard's own Stayed/
// Visited control). Lives in the nav bar (not tucked into Trip
// Settings) so it's visible right where you're looking at the trip's
// own sections, not off on a settings page.
export default function ArchiveUnvisitedButton({ trip, nav, triggerClassName }: ArchiveUnvisitedButtonProps) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const [done, setDone] = useState<PreviewState | null>(null);
  const [error, setError] = useState("");

  async function openAndPreview() {
    setOpen(true);
    setDone(null);
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`/api/trips/${trip.slug}/archive-unvisited`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't load a preview");
      setPreview(data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function confirmArchive() {
    setArchiving(true);
    setError("");
    try {
      const res = await fetch(`/api/trips/${trip.slug}/archive-unvisited`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Archive failed");
      setDone(data);
      setPreview(null);
      // Every entries query this trip could have cached — a plain
      // ["entries", trip.slug] prefix would also work (partial keys
      // match), but being explicit per group/section means a
      // subsequent section-page mount doesn't briefly show pre-archive
      // data before catching up.
      for (const group of nav) {
        for (const section of group.sections) {
          queryClient.invalidateQueries({ queryKey: ["entries", trip.slug, group.slug, section.slug] });
        }
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setArchiving(false);
    }
  }

  return (
    <>
      <Button variant="ghost" size="sm" onClick={openAndPreview} className={triggerClassName}>
        Archive unvisited
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogTitle>Archive everything not stayed/visited?</DialogTitle>
          <DialogDescription>
            Anything still unchecked gets archived (not deleted — restorable from each section&apos;s own archived
            list afterward). Nothing checked Stayed/Visited is touched.
          </DialogDescription>

          {loading && <p className={styles.status}>Loading…</p>}
          {error && <p className={styles.error}>{error}</p>}

          {done && (
            <p className={styles.status}>
              {done.totalArchived === 0
                ? "Nothing to archive — everything was already checked off."
                : `Archived ${done.totalArchived} item${done.totalArchived === 1 ? "" : "s"}.`}
            </p>
          )}

          {!loading && !done && preview && (
            <>
              {preview.totalArchived === 0 ? (
                <p className={styles.status}>Nothing to archive — everything&apos;s already checked off.</p>
              ) : (
                <ul className={styles.countList}>
                  {preview.counts.map((c) => (
                    <li key={`${c.navGroupSlug}-${c.sectionLabel}`}>
                      {c.sectionLabel}: {c.toArchive} item{c.toArchive === 1 ? "" : "s"}
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}

          <div className={styles.actions}>
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
              {done ? "Close" : "Cancel"}
            </Button>
            {!done && preview && preview.totalArchived > 0 && (
              <Button variant="danger" size="sm" onClick={confirmArchive} disabled={archiving}>
                {archiving ? "Archiving…" : `Archive ${preview.totalArchived} item${preview.totalArchived === 1 ? "" : "s"}`}
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
