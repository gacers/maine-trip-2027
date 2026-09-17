import { useState } from "react";
import classNames from "classnames";
import { ChevronUp } from "lucide-react";
import EntryCard from "@/components/EntryCard";
import EntryMedia from "@/components/EntryMedia";
import ListingSection from "@/components/ListingSection";
import GroupMap from "@/components/GroupMap";
import SimpleGroupMap from "@/components/SimpleGroupMap";
import type { ClientEntry, EntryUnit, FieldDef, MapConfig } from "@/lib/types";
import styles from "./PairedEntryGroup.module.css";

const GROUP_SUFFIX = "2 House Option";
// Admins just name the pair itself ("Gouldsboro") — this appends the
// suffix so it's never on them to type/remember it consistently.
// Guards against double-appending for any group whose stored label
// already has it from before this was automatic.
function groupTitle(label: string | null | undefined): string {
  const base = (label || "").trim();
  return base.toLowerCase().endsWith(GROUP_SUFFIX.toLowerCase()) ? base : `${base} - ${GROUP_SUFFIX}`;
}

export interface PairedEntryGroupProps {
  unit: Extract<EntryUnit, { type: "group" }>;
  fieldDefs: FieldDef[];
  mapConfig?: MapConfig;
  tripSlug: string;
  onPatch: (id: string, patch: Record<string, unknown>) => void;
  onDelete: (id: string) => void;
  onRate: (id: string, score: number | null) => void;
  canManage: boolean;
  canContribute: boolean;
  showRatings: boolean;
  comparisonMode: boolean;
  isCompactMedia: boolean;
  isLargeMedia: boolean;
  isMediumMedia: boolean;
  nightsEstimate: number | null;
  tripCompleted: boolean;
  /** Passed straight through to ListingSection — see its own className
   * doc. Set by SectionPage when the section's card_layout is a grid,
   * so this comparison card spans the whole row instead of one column. */
  className?: string;
  /** Same idea as EntryCard's own `collapsible` (a full-width "list"
   * layout card), applied to the whole pair at once — see this
   * component's own collapse handling below for why the state lives
   * here rather than inside ListingSection: the toggle itself needs to
   * live as an overlay on the photo row while expanded (this
   * component builds that row), then hand off into ListingSection's
   * own header once there's no more photo to sit on. */
  collapsible?: boolean;
}

// A 2-item paired option — one shared frame/header (ListingSection)
// around two otherwise-bare EntryCards, both photos laid out as their
// own row above the shared title, and one shared map below both.
export default function PairedEntryGroup({
  unit,
  fieldDefs,
  mapConfig,
  tripSlug,
  onPatch,
  onDelete,
  onRate,
  canManage,
  canContribute,
  showRatings,
  comparisonMode,
  isCompactMedia,
  isLargeMedia,
  isMediumMedia,
  nightsEstimate,
  tripCompleted,
  className,
  collapsible = false,
}: PairedEntryGroupProps) {
  const [collapsed, setCollapsed] = useState(false);
  const isCollapsed = collapsible && collapsed;

  return (
    <ListingSection
      key={unit.listings.map((e) => e.id).join("-")}
      id={`group-${unit.listings[0].id}`}
      className={className}
      collapsible={collapsible}
      collapsed={isCollapsed}
      onToggleCollapse={() => setCollapsed((c) => !c)}
      title={groupTitle(unit.listings[0].groupLabel)}
      media={
        <div className={classNames(styles["media-row-wrap"], isCollapsed && styles["media-row-wrap-collapsed"])}>
          <div className={styles["media-row-inner"]}>
            <div className={styles["media-row"]}>
              {unit.listings.map((entry) => (
                <div key={entry.id} className={styles["media-half"]}>
                  <EntryMedia entry={entry} compact={isCompactMedia} large={isLargeMedia} medium={isMediumMedia} showRatings={showRatings} />
                </div>
              ))}
            </div>
          </div>
          {/* Left corner, not right — each half's own EntryMedia
              already puts its own score badge at ITS top-right (see
              EntryMedia), and the rightmost photo's own badge would
              otherwise sit in the exact same corner as this. Only
              rendered while expanded — collapsing hands this same
              toggle off to ListingSection's own header instead (see
              its own comment), same idea as EntryCard/EntryMedia's own
              solo-card version. */}
          {collapsible && !isCollapsed && (
            <button
              type="button"
              onClick={() => setCollapsed((c) => !c)}
              className={styles["collapse-toggle-overlay"]}
              aria-expanded={!isCollapsed}
              title="Collapse"
            >
              <ChevronUp size={18} />
            </button>
          )}
        </div>
      }
      canArchiveGroup={canContribute}
      showRatings={showRatings}
      canContribute={canContribute}
      myScore={unit.listings[0].myScore ?? null}
      onRate={(score) => unit.listings.forEach((e) => onRate(e.id, score))}
      onDeleteGroup={
        unit.listings[0].status === "archived"
          ? null
          : (reason: string) => unit.listings.forEach((e) => onPatch(e.id, { archiveReason: reason, status: "archived" }))
      }
      editableTitle={unit.listings[0].groupLabel || ""}
      onEditTitle={(newLabel) => unit.listings.forEach((e) => onPatch(e.id, { groupLabel: newLabel }))}
    >
      <div className={styles["listings"]}>
        {unit.listings.map((entry: ClientEntry) => (
          <div key={entry.id} className={styles["listing-half"]}>
            <EntryCard
              entry={entry}
              fieldDefs={fieldDefs}
              mapConfig={mapConfig}
              tripSlug={tripSlug}
              onPatch={onPatch}
              onDelete={onDelete}
              onRate={onRate}
              canManage={canManage}
              canContribute={canContribute}
              bare
              hideMedia
              showRatings={showRatings}
              showRatingControl={false}
              showMap={false}
              compact={isCompactMedia}
              mediumMedia={isMediumMedia}
              nightsEstimate={nightsEstimate}
              showVisitedControl={tripCompleted}
            />
          </div>
        ))}
      </div>
      {comparisonMode ? (
        <GroupMap listings={unit.listings} mapConfig={mapConfig} tripSlug={tripSlug} />
      ) : (
        <div className={styles["map-section"]}>
          <SimpleGroupMap listings={unit.listings} />
        </div>
      )}
    </ListingSection>
  );
}
