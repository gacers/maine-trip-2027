"use client";

import { useState, type ReactNode } from "react";
import ArchiveDialog from "@/components/ArchiveDialog";
import Button from "@/components/Button";
import StarRating from "@/components/StarRating";
import styles from "./ListingSection.module.css";

export interface ListingSectionProps {
  title: ReactNode;
  children: ReactNode;
  id?: string;
  /** Both houses' own photos, laid out as their own row ahead of this
   * group's title section — see SectionPage, which builds this from
   * EntryMedia directly so each EntryCard below can skip its own copy
   * (hideMedia). Edge-to-edge, no padding, same as a solo card's photo. */
  media?: ReactNode;
  canManage?: boolean;
  onDeleteGroup?: ((reason: string) => void) | null;
  /** A 2-house-option group is rated as one option, not twice — one
   * shared "Your score" control here instead of each half's own
   * EntryCard rendering its own (see EntryCard's showRatingControl,
   * off for a group's own members). */
  showRatings?: boolean;
  canContribute?: boolean;
  myScore?: number | null;
  onRate?: (score: number | null) => void;
}

// The shared frame around a 2-house-option group: both houses' photos
// first (edge-to-edge, like a solo card), then this group's own title
// section (label, shared score, "Delete group"), then two otherwise-
// bare EntryCards in its body, each with its own title/eyebrows/price
// below that — matching a solo card's own image-then-title order
// exactly. `onDeleteGroup` archives both listings in the pair at once
// with one shared reason, via the same ArchiveDialog each individual
// EntryCard already uses for its own per-listing Delete — that per-
// listing control still works too, this is just a faster path when the
// whole pair is out.
export default function ListingSection({
  title,
  children,
  id,
  media,
  canManage,
  onDeleteGroup,
  showRatings,
  canContribute,
  myScore,
  onRate,
}: ListingSectionProps) {
  const [showArchiveDialog, setShowArchiveDialog] = useState(false);

  function archiveGroup(reason: string) {
    onDeleteGroup?.(reason);
    setShowArchiveDialog(false);
  }

  return (
    <section id={id} className={styles["root"]}>
      {media}
      <div className={styles["header"]}>
        <div className={styles["title-area"]}>
          <h2 className={styles["title"]}>{title}</h2>
          {showRatings && canContribute && onRate && (
            <div className={styles["user-rating-row"]}>
              <span className={styles["rating-caption"]}>Your score</span>
              <StarRating value={myScore ?? 0} size={18} onChange={(v) => onRate(v)} />
              {myScore != null && (
                <Button variant="ghost" size="sm" onClick={() => onRate(null)} className={styles["clear-score-button"]}>
                  Clear
                </Button>
              )}
            </div>
          )}
        </div>
        <div className={styles["controls"]}>
          {canManage && onDeleteGroup && (
            <div className={styles["delete-group-wrapper"]}>
              <Button variant="danger" size="sm" onClick={() => setShowArchiveDialog(true)}>
                Delete group
              </Button>
              <ArchiveDialog open={showArchiveDialog} onOpenChange={setShowArchiveDialog} onConfirm={archiveGroup} />
            </div>
          )}
        </div>
      </div>
      <div className={styles["body"]}>{children}</div>
    </section>
  );
}
