"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/Dialog";
import Button from "@/components/Button";
import type { PublicTrip, NavGroup } from "@/lib/types";
import styles from "./ResetAllRatingsButton.module.css";

export interface ResetAllRatingsButtonProps {
  trip: PublicTrip;
  /** Used to invalidate every section's entries cache after a wipe —
   * same pattern as ArchiveUnvisitedButton. */
  nav: NavGroup[];
  triggerClassName?: string;
}

// Admin-only bulk wipe of every rater's score across every ratings-
// enabled section on this trip (Stay Options and any other section with
// supports_ratings). Lives on Trip Settings next to other destructive
// bulk actions; the per-option reset is on the entry edit footer.
export default function ResetAllRatingsButton({ trip, nav, triggerClassName }: ResetAllRatingsButtonProps) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [doneCount, setDoneCount] = useState<number | null>(null);
  const [error, setError] = useState("");

  function openDialog() {
    setOpen(true);
    setDoneCount(null);
    setError("");
  }

  async function confirmReset() {
    setResetting(true);
    setError("");
    try {
      const res = await fetch(`/api/trips/${trip.slug}/reset-ratings`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't reset rankings");
      setDoneCount(data.deletedCount ?? 0);
      // Invalidate every section on this trip — safer than trusting
      // supports_ratings on the nav payload used for the settings page.
      for (const group of nav) {
        for (const section of group.sections) {
          queryClient.invalidateQueries({ queryKey: ["entries", trip.slug, group.slug, section.slug] });
        }
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setResetting(false);
    }
  }

  return (
    <>
      <Button variant="secondary" size="sm" onClick={openDialog} className={triggerClassName}>
        Reset all rankings
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogTitle>Reset all rankings on this trip?</DialogTitle>
          <DialogDescription>
            Clears every rater&apos;s score on every Stay Option (and any other ratings-enabled section). This cannot be
            undone — everyone will need to rate options again from scratch.
          </DialogDescription>

          {error && <p className={styles["error"]}>{error}</p>}

          {doneCount != null && (
            <p className={styles["status"]}>
              {doneCount === 0
                ? "Nothing to reset — there were no rankings yet."
                : `Cleared ${doneCount} ranking${doneCount === 1 ? "" : "s"}.`}
            </p>
          )}

          <div className={styles["actions"]}>
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)} disabled={resetting}>
              {doneCount != null ? "Close" : "Cancel"}
            </Button>
            {doneCount == null && (
              <Button variant="danger" size="sm" onClick={confirmReset} disabled={resetting}>
                {resetting ? "Resetting…" : "Reset all rankings"}
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
