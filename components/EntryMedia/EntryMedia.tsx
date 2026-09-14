import type { ClientEntry } from "@/lib/types";
import styles from "./EntryMedia.module.css";

export interface EntryMediaProps {
  entry: Pick<ClientEntry, "posterImage" | "title" | "averageScore" | "ratingCount">;
  compact?: boolean;
  showRatings?: boolean;
}

// Just the poster photo + its avg-score badge overlay — split out of
// EntryCard so a 2-house-option group can lay its two photos out as
// their own row (see SectionPage), with the group's title section
// underneath both, before each house's own remaining content
// continues below that. EntryCard itself renders this exact same
// component for a solo/compact card (hideMedia lets it skip its own
// copy when a caller like SectionPage is placing this separately).
export default function EntryMedia({ entry, compact = false, showRatings = false }: EntryMediaProps) {
  if (!entry.posterImage) return null;
  return (
    <div className={compact ? styles.mediaHeaderCompact : styles.mediaHeader}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={entry.posterImage} alt={entry.title ?? ""} className={styles.mediaImg} loading="lazy" />
      {showRatings && !!entry.ratingCount && entry.averageScore != null && (
        <div className={styles.scoreBadge} title={`${entry.averageScore.toFixed(1)} avg (${entry.ratingCount})`}>
          {entry.averageScore.toFixed(1)}
        </div>
      )}
    </div>
  );
}
