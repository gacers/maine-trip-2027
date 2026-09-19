"use client";

import { useState, type ReactNode } from "react";
import classNames from "classnames";
import { ChevronDown, ChevronUp } from "lucide-react";
import ArchiveDialog from "@/components/ArchiveDialog";
import Button from "@/components/Button";
import StarRating from "@/components/StarRating";
import styles from "./ListingSection.module.css";

export interface ListingSectionProps {
  title: ReactNode;
  children: ReactNode;
  id?: string;
  /** Extra class on the root <section> — e.g. PairedEntryGroup passing
   * a grid-span override so a 2-house comparison card takes the whole
   * row inside a grid-2/grid-3 section instead of just one column's
   * worth (see SectionPage's renderUnit). */
  className?: string;
  /** Both houses' own photos, laid out as their own row ahead of this
   * group's title section — see SectionPage, which builds this from
   * EntryMedia directly so each EntryCard below can skip its own copy
   * (hideMedia). Edge-to-edge, no padding, same as a solo card's photo. */
  media?: ReactNode;
  /** Gates "Delete group"/"Edit" below — really an archive-with-a-
   * reason (see PairedEntryGroup's onDeleteGroup), not a permanent
   * delete, so this is the same "admin or contributor" capability as
   * editing/archiving an individual entry, not admin-only. */
  canArchiveGroup?: boolean;
  onDeleteGroup?: ((reason: string) => void) | null;
  /** The raw, unformatted group label (see PairedEntryGroup's own
   * groupTitle) — `title` above is what's actually displayed (with the
   * "2 House Option" suffix baked in), this is what a text input
   * actually edits. Both entries in the pair share one groupLabel
   * (that's what pairs them at all — see lib/groupUnits.ts), so
   * `onEditTitle` below is expected to update both at once. */
  editableTitle?: string;
  onEditTitle?: (newLabel: string) => void;
  /** The first listing's own address/map link — a group has two
   * addresses, one per half, and this just surfaces the first one here
   * (same idea as a solo card's own address-link) rather than picking
   * neither. See PairedEntryGroup, which resolves this the same way
   * EntryCard resolves its own. */
  addressLabel?: string | null;
  addressUrl?: string;
  /** A 2-house-option group is rated as one option, not twice — one
   * shared "Your score" control here instead of each half's own
   * EntryCard rendering its own (see EntryCard's showRatingControl,
   * off for a group's own members). */
  showRatings?: boolean;
  canContribute?: boolean;
  myScore?: number | null;
  onRate?: (score: number | null) => void;
  /** Offers a Collapse/Expand toggle in the header, next to Delete
   * group — same idea as EntryCard's own `collapsible` (a full-width
   * "list" layout card is tall enough that being able to shrink it
   * down to just its title is worth it), applied to the whole pair at
   * once rather than each half separately: collapsing hides both
   * halves' own bodies, leaving just this header (and, once `media`
   * has shrunk itself away too, this is also where the toggle itself
   * ends up living — see below). */
  collapsible?: boolean;
  /** Controlled, not owned here — PairedEntryGroup needs the same
   * value to also drive its own photo-row overlay toggle (see its own
   * comment on why), so there's one shared source of truth rather than
   * two independent collapsed states that could drift apart. */
  collapsed?: boolean;
  onToggleCollapse?: () => void;
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
  canArchiveGroup,
  onDeleteGroup,
  editableTitle,
  onEditTitle,
  showRatings,
  canContribute,
  myScore,
  onRate,
  className,
  collapsible = false,
  collapsed = false,
  onToggleCollapse,
  addressLabel,
  addressUrl,
}: ListingSectionProps) {
  const [showArchiveDialog, setShowArchiveDialog] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(editableTitle ?? "");
  const isCollapsed = collapsible && collapsed;

  function archiveGroup(reason: string) {
    onDeleteGroup?.(reason);
    setShowArchiveDialog(false);
  }

  function startEditTitle() {
    setTitleDraft(editableTitle ?? "");
    setIsEditingTitle(true);
  }

  function saveTitle() {
    const trimmed = titleDraft.trim();
    if (trimmed) onEditTitle?.(trimmed);
    setIsEditingTitle(false);
  }

  return (
    <section id={id} className={classNames(styles["root"], className)}>
      {/* Always rendered, not gated on isCollapsed — the caller-built
          `media` (PairedEntryGroup) owns its own shrink/fade transition
          keyed off the same collapsed value, rather than this just
          unmounting it outright and losing that animation. */}
      {media}
      <div className={styles["header"]}>
        <div className={styles["title-area"]}>
          {isEditingTitle ? (
            <div className={styles["title-edit-row"]}>
              <input
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && saveTitle()}
                autoFocus
                className={styles["title-input"]}
              />
              <Button variant="primary" size="sm" onClick={saveTitle}>
                Save
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setIsEditingTitle(false)}>
                Cancel
              </Button>
            </div>
          ) : (
            <div className={styles["title-row"]}>
              <h2 className={styles["title"]}>{title}</h2>
            </div>
          )}
          {/* Stays visible collapsed too — same reasoning as EntryCard's
              own address-link. */}
          {addressUrl && (
            <a href={addressUrl} target="_blank" rel="noopener noreferrer" className={styles["address-link"]}>
              {addressLabel || "View on map"}
            </a>
          )}
          {!isCollapsed && showRatings && canContribute && onRate && (
            <div className={styles["user-rating-row"]}>
              <span className={styles["rating-caption"]}>Your score</span>
              <StarRating value={myScore ?? 0} size={18} onChange={(v) => onRate(v)} />
              {myScore != null && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    // See EntryCard's own identical Clear button for
                    // why this blur has to happen first.
                    e.currentTarget.blur();
                    onRate(null);
                  }}
                  className={styles["clear-score-button"]}
                >
                  Clear
                </Button>
              )}
            </div>
          )}
        </div>
        <div className={styles["controls"]}>
          {!isCollapsed && canArchiveGroup && (onDeleteGroup || (onEditTitle && !isEditingTitle)) && (
            <div className={styles["group-actions"]}>
              {onDeleteGroup && (
                <div className={styles["delete-group-wrapper"]}>
                  <Button variant="danger" size="sm" onClick={() => setShowArchiveDialog(true)}>
                    Delete group
                  </Button>
                  <ArchiveDialog open={showArchiveDialog} onOpenChange={setShowArchiveDialog} onConfirm={archiveGroup} />
                </div>
              )}
              {onEditTitle && !isEditingTitle && (
                <button type="button" onClick={startEditTitle} className={styles["edit-title-button"]}>
                  Edit Title
                </button>
              )}
            </div>
          )}
          {/* While there's still a photo row, PairedEntryGroup hosts
              this same toggle as an overlay on it instead (see its own
              comment) — this copy slides in here (width/margin/opacity
              all transitioning) the moment that photo row has shrunk
              itself away, same hand-off idea as EntryCard/EntryMedia's
              own solo-card version. */}
          {collapsible && (
            <span className={classNames(styles["header-toggle-wrap"], isCollapsed && styles["header-toggle-wrap-visible"])}>
              <button
                type="button"
                onClick={onToggleCollapse}
                className={styles["collapse-toggle"]}
                aria-expanded={!isCollapsed}
                title={isCollapsed ? "Expand" : "Collapse"}
              >
                {isCollapsed ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
              </button>
            </span>
          )}
        </div>
      </div>
      {!isCollapsed && <div className={styles["body"]}>{children}</div>}
    </section>
  );
}
