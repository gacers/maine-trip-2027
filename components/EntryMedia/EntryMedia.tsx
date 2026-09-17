"use client";

import { useState } from "react";
import classNames from "classnames";
import { ChevronDown, ChevronUp } from "lucide-react";
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
  /** Offers the Collapse/Expand toggle as an overlay chip right on the
   * photo, next to the score badge — see EntryCard's own `collapsible`
   * prop. Only meaningful when there IS a photo; a photo-less entry
   * falls back to a plain button in EntryCard's header row instead,
   * since there's nothing here to overlay it on. */
  collapsible?: boolean;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
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
  collapsible = false,
  collapsed = false,
  onToggleCollapse,
}: EntryMediaProps) {
  // A pasted URL (there's no real upload — see TripSettingsForm) can go
  // stale after the fact (a listing taken down, a hosting site
  // rotating its CDN links) — treated the same as never having had a
  // photo at all, rather than showing a broken-image icon.
  const [failed, setFailed] = useState(false);
  if (!entry.posterImage || failed) return null;
  // Shrinks down to just enough room for the overlay row itself (the
  // toggle + score badge) rather than disappearing outright — the
  // photo fades out under them, but the row they're sitting in stays
  // put in the same spot the whole time, collapsed or not (see
  // EntryCard's own comment on why this needed to move here at all).
  // Collapsed always wins over compact/large/medium — there's no
  // "collapsed-but-still-large" state.
  const sizeClass = collapsed
    ? styles["root-collapsed"]
    : compact
      ? styles["root-compact"]
      : large
        ? styles["root-large"]
        : medium
          ? styles["root-medium"]
          : styles["root"];

  return (
    <div className={sizeClass}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={entry.posterImage}
        alt={entry.title ?? ""}
        className={classNames(styles["media-img"], collapsed && styles["media-img-collapsed"])}
        loading="lazy"
        onError={() => setFailed(true)}
      />
      {(collapsible || (showRatings && !!entry.ratingCount && entry.averageScore != null)) && (
        <div className={styles["overlay-row"]}>
          {collapsible && (
            <button
              type="button"
              onClick={onToggleCollapse}
              className={styles["collapse-toggle"]}
              aria-expanded={!collapsed}
              title={collapsed ? "Expand" : "Collapse"}
            >
              {collapsed ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
            </button>
          )}
          {showRatings && !!entry.ratingCount && entry.averageScore != null && (
            <div className={styles["score-badge"]} title={`${entry.averageScore.toFixed(1)} avg (${entry.ratingCount})`}>
              {entry.averageScore.toFixed(1)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
