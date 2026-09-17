import { useEffect, useState } from "react";
import classNames from "classnames";
import { ChevronUp } from "lucide-react";
import EntryCard from "@/components/EntryCard";
import EntryMedia from "@/components/EntryMedia";
import ListingSection from "@/components/ListingSection";
import GroupMap from "@/components/GroupMap";
import SimpleGroupMap from "@/components/SimpleGroupMap";
import { fetchReverseAddress } from "@/lib/geocodeClient";
import { hasCoords } from "@/lib/listingUtils";
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

  // The group's own header has no single card's worth of address to
  // show — this just picks the first listing's, same "good enough,
  // better than neither" reasoning as myScore/editableTitle above
  // already reading off unit.listings[0] alone.
  const firstListing = unit.listings[0];
  const [firstAddressLabel, setFirstAddressLabel] = useState<string | null>(null);
  useEffect(() => {
    if (!hasCoords(firstListing)) {
      setFirstAddressLabel(null);
      return;
    }
    let cancelled = false;
    fetchReverseAddress(tripSlug, firstListing.lat as number, firstListing.lng as number)
      .then((result) => {
        if (!cancelled) setFirstAddressLabel(result?.formattedAddress ?? null);
      })
      .catch(() => {
        // Non-fatal — the map-pin link below still works via lat/lng.
      });
    return () => {
      cancelled = true;
    };
    // Depend on the primitive coordinates, not `firstListing` itself —
    // it's a fresh object (unit.listings[0]) every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firstListing.lat, firstListing.lng, tripSlug]);
  const firstAddressUrl = hasCoords(firstListing)
    ? `https://www.google.com/maps/search/?api=1&query=${firstListing.lat},${firstListing.lng}`
    : undefined;

  return (
    <ListingSection
      key={unit.listings.map((e) => e.id).join("-")}
      id={`group-${unit.listings[0].id}`}
      className={className}
      collapsible={collapsible}
      collapsed={isCollapsed}
      onToggleCollapse={() => setCollapsed((c) => !c)}
      title={groupTitle(unit.listings[0].groupLabel)}
      addressLabel={firstAddressLabel}
      addressUrl={firstAddressUrl}
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
          {/* Top-right, matching the solo card exactly. Only rendered
              while expanded — collapsing hands this same toggle off to
              ListingSection's own header instead (see its own
              comment), same idea as EntryCard/EntryMedia's own solo-
              card version. */}
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
