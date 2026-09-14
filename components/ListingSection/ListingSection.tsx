"use client";

import { useEffect, useState, type ReactNode } from "react";
import ArchiveDialog from "@/components/ArchiveDialog";
import styles from "./ListingSection.module.css";

export interface ListingSectionBadge {
  key: string;
  label: string;
}

export interface ListingSectionProps {
  title: ReactNode;
  children: ReactNode;
  id?: string;
  href?: string;
  /** Only passed for a 2-house-option group, where the pair shares a
   * single rank instead of each card having its own. */
  rank?: number;
  onRankChange?: (rank: number) => void;
  badges?: ListingSectionBadge[];
  canManage?: boolean;
  onDeleteGroup?: ((reason: string) => void) | null;
}

// `onDeleteGroup` (group-only) archives both listings in the pair at
// once with one shared reason, via the same ArchiveDialog each individual
// EntryCard already uses for its own per-listing Delete — that per-listing
// control still works too, this is just a faster path when the whole pair
// is out.
// `badges` (an entry's true boolean fields, e.g. "Closed") render next
// to the title here rather than inside EntryCard's own body whenever
// this component — not EntryCard — is the one actually showing the
// title (a solo, non-grouped entry passes its title/href here and hides
// its own via showTitle={false}; see SectionPage).
export default function ListingSection({
  title,
  children,
  id,
  href,
  rank,
  onRankChange,
  badges,
  canManage,
  onDeleteGroup,
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
      <div className={styles.header}>
        <div className={styles.titleArea}>
          <h2 className={styles.title}>
            {href ? (
              <a href={href} target="_blank" rel="noopener noreferrer" className={styles.titleLink}>
                {title}
              </a>
            ) : (
              title
            )}
          </h2>
          {badges && badges.length > 0 && (
            <div className={styles.badges}>
              {badges.map((b) => (
                <span key={b.key} className={styles.badge}>
                  {b.label}
                </span>
              ))}
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
              <button
                type="button"
                onClick={() => setShowArchiveDialog((v) => !v)}
                className={styles.deleteGroupButton}
              >
                Delete group
              </button>
              {showArchiveDialog && (
                <ArchiveDialog onConfirm={archiveGroup} onCancel={() => setShowArchiveDialog(false)} />
              )}
            </div>
          )}
        </div>
      </div>
      <div className={styles.body}>{children}</div>
    </section>
  );
}
