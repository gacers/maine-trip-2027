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
}

// A 2-item paired option — one shared frame/header (ListingSection)
// around two otherwise-bare EntryCards, both photos laid out as their
// own row above the shared title, and one shared map below both.
export default function PairedEntryGroup({
  unit,
  fieldDefs,
  mapConfig,
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
}: PairedEntryGroupProps) {
  return (
    <ListingSection
      key={unit.listings.map((e) => e.id).join("-")}
      id={`group-${unit.listings[0].id}`}
      title={groupTitle(unit.listings[0].groupLabel)}
      media={
        <div className={styles["media-row"]}>
          {unit.listings.map((entry) => (
            <div key={entry.id} className={styles["media-half"]}>
              <EntryMedia entry={entry} compact={isCompactMedia} large={isLargeMedia} medium={isMediumMedia} showRatings={showRatings} />
            </div>
          ))}
        </div>
      }
      canManage={canManage}
      showRatings={showRatings}
      canContribute={canContribute}
      myScore={unit.listings[0].myScore ?? null}
      onRate={(score) => unit.listings.forEach((e) => onRate(e.id, score))}
      onDeleteGroup={
        unit.listings[0].status === "archived"
          ? null
          : (reason: string) => unit.listings.forEach((e) => onPatch(e.id, { archiveReason: reason, status: "archived" }))
      }
    >
      <div className={styles["listings"]}>
        {unit.listings.map((entry: ClientEntry) => (
          <div key={entry.id} className={styles["listing-half"]}>
            <EntryCard
              entry={entry}
              fieldDefs={fieldDefs}
              mapConfig={mapConfig}
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
        <GroupMap listings={unit.listings} mapConfig={mapConfig} />
      ) : (
        <div className={styles["map-section"]}>
          <SimpleGroupMap listings={unit.listings} />
        </div>
      )}
    </ListingSection>
  );
}
