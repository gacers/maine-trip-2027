"use client";

import { useState } from "react";
import classNames from "classnames";
import { ChevronUp } from "lucide-react";
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
   * prop. Only shown while expanded (there's a photo to overlay it on
   * then); collapsing shrinks the photo away entirely, and EntryCard's
   * own header row picks the same toggle back up next to the price —
   * see its own comment for why. */
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
  // Shrinks all the way to nothing (not just a shorter strip) — a
  // collapsed card shouldn't keep a grey placeholder bar around once
  // its photo has faded out. Collapsed always wins over compact/large/
  // medium — there's no "collapsed-but-still-large" state.
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
      {/* Only while there's still a photo to sit on — collapsing hands
          this same toggle off to EntryCard's header row instead (see
          its own comment), rather than clipping it away invisibly here
          as the photo shrinks to nothing. */}
      {!collapsed && (collapsible || (showRatings && !!entry.ratingCount && entry.averageScore != null)) && (
        <div className={styles["overlay-row"]}>
          {showRatings && !!entry.ratingCount && entry.averageScore != null && (
            <div className={styles["score-badge"]} title={`${entry.averageScore.toFixed(1)} avg (${entry.ratingCount})`}>
              {entry.averageScore.toFixed(1)}
            </div>
          )}
          {collapsible && (
            <button
              type="button"
              onClick={onToggleCollapse}
              className={styles["collapse-toggle"]}
              aria-expanded={!collapsed}
              title="Collapse"
            >
              <ChevronUp size={18} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
