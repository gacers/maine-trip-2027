"use client";

import { useEffect, useState, type ReactNode } from "react";
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
  /** Only passed for a 2-house-option group, where the pair shares a
   * single rank instead of each card having its own. */
  rank?: number;
  onRankChange?: (rank: number) => void;
  canManage?: boolean;
  onDeleteGroup?: ((reason: string) => void) | null;
  /** A 2-house-option group is rated as one option, not twice — one
   * shared "Your score" control here (mirroring the shared rank above)
   * instead of each half's own EntryCard rendering its own (see
   * EntryCard's showRatingControl, off for a group's own members). */
  showRatings?: boolean;
  canContribute?: boolean;
  myScore?: number | null;
  onRate?: (score: number | null) => void;
}

// The shared frame around a 2-house-option group: both houses' photos
// first (edge-to-edge, like a solo card), then this group's own title
// section (label, shared rank, shared score, "Delete group"), then two
// otherwise-bare EntryCards in its body, each with its own title/
// eyebrows/price below that — matching a solo card's own image-then-
// title order exactly. `onDeleteGroup` archives both listings in the
// pair at once with one shared reason, via the same ArchiveDialog each
// individual EntryCard already uses for its own per-listing Delete —
// that per-listing control still works too, this is just a faster path
// when the whole pair is out.
export default function ListingSection({
  title,
  children,
  id,
  media,
  rank,
  onRankChange,
  canManage,
  onDeleteGroup,
  showRatings,
  canContribute,
  myScore,
  onRate,
}: ListingSectionProps) {
  const [rankDraft, setRankDraft] = useState(rank ?? "");
  const [showArchiveDialog, setShowArchiveDialog] = useState(false);

  // `rank` can change for reasons other than this exact input's own edit
  // (e.g. the group's "representative" listing shifting after a
  // re-fetch) — without this, the box would keep showing whatever was
  // last typed/mounted with instead of following the real value.
  useEffect(() => {
    setRankDraft(rank ?? "");
  }, [rank]);

  function commitRank() {
    const n = Number(rankDraft);
    if (!Number.isNaN(n) && n !== rank && onRankChange) {
      onRankChange(n);
    }
  }

  function archiveGroup(reason: string) {
    onDeleteGroup?.(reason);
    setShowArchiveDialog(false);
  }

  return (
    <section id={id} className={styles.section}>
      {media}
      <div className={styles.header}>
        <div className={styles.titleArea}>
          <h2 className={styles.title}>{title}</h2>
          {showRatings && canContribute && onRate && (
            <div className={styles.userRatingRow}>
              <span className={styles.ratingCaption}>Your score</span>
              <StarRating value={myScore ?? 0} size={18} onChange={(v) => onRate(v)} />
              {myScore != null && (
                <Button variant="ghost" size="sm" onClick={() => onRate(null)} className={styles.clearScoreButton}>
                  Clear
                </Button>
              )}
            </div>
          )}
        </div>
        <div className={styles.controls}>
          {rank !== undefined && (
            <div className={styles.rankControl}>
              <label className={styles.rankLabel}>Rank</label>
              <input
                type="number"
                value={rankDraft}
                onChange={(e) => setRankDraft(e.target.value)}
                onBlur={commitRank}
                className={styles.rankInput}
              />
            </div>
          )}
          {canManage && onDeleteGroup && (
            <div className={styles.deleteGroupWrapper}>
              <Button variant="danger" size="sm" onClick={() => setShowArchiveDialog(true)}>
                Delete group
              </Button>
              <ArchiveDialog open={showArchiveDialog} onOpenChange={setShowArchiveDialog} onConfirm={archiveGroup} />
            </div>
          )}
        </div>
      </div>
      <div className={styles.body}>{children}</div>
    </section>
  );
}
