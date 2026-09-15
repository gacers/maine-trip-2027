"use client";

import { useState } from "react";
import type { ClientEntry } from "@/lib/types";
import styles from "./EntryMedia.module.css";

export interface EntryMediaProps {
  entry: Pick<ClientEntry, "posterImage" | "title" | "averageScore" | "ratingCount">;
  compact?: boolean;
  /** Houses' own cards get a taller photo than the default — richer/
   * full-width cards can support it, and a bigger house photo is
   * actually useful, unlike a listing that's mostly text. Ignored when
   * compact is also set (compact always wins, e.g. a paired option's
   * shared media row). */
  large?: boolean;
  /** The "small card, two per row" layout's own in-between photo
   * height — shorter than a full-width list card, taller than the
   * compact 3-across grid. Ignored when compact or large is also set. */
  medium?: boolean;
  showRatings?: boolean;
}

// Just the poster photo + its avg-score badge overlay — split out of
// EntryCard so a 2-house-option group can lay its two photos out as
// their own row (see SectionPage), with the group's title section
// underneath both, before each house's own remaining content
// continues below that. EntryCard itself renders this exact same
// component for a solo/compact card (hideMedia lets it skip its own
// copy when a caller like SectionPage is placing this separately).
export default function EntryMedia({
  entry,
  compact = false,
  large = false,
  medium = false,
  showRatings = false,
}: EntryMediaProps) {
  // A pasted URL (there's no real upload — see TripSettingsForm) can go
  // stale after the fact (a listing taken down, a hosting site
  // rotating its CDN links) — treated the same as never having had a
  // photo at all, rather than showing a broken-image icon.
  const [failed, setFailed] = useState(false);
  if (!entry.posterImage || failed) return null;
  const headerClass = compact
    ? styles["root-compact"]
    : large
      ? styles["root-large"]
      : medium
        ? styles["root-medium"]
        : styles["root"];
  return (
    <div className={headerClass}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={entry.posterImage}
        alt={entry.title ?? ""}
        className={styles["media-img"]}
        loading="lazy"
        onError={() => setFailed(true)}
      />
      {showRatings && !!entry.ratingCount && entry.averageScore != null && (
        <div className={styles["score-badge"]} title={`${entry.averageScore.toFixed(1)} avg (${entry.ratingCount})`}>
          {entry.averageScore.toFixed(1)}
        </div>
      )}
    </div>
  );
}
