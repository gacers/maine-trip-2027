import { createPortal } from "react-dom";
import AddEntryDialog from "@/components/AddEntryDialog";
import Button from "@/components/Button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/DropdownMenu";
import { useNavSlot } from "@/components/TripNavHeader/NavSlot";
import type { PublicTrip, Section, ClientEntry, FieldDef } from "@/lib/types";
import styles from "./UtilityControls.module.css";

export type SortBy = "newest" | "oldest" | "myScore" | "averageScore" | "visitedDate";

export const SORT_BY_LABELS: Record<SortBy, string> = {
  newest: "Newest",
  oldest: "Oldest",
  myScore: "My Score",
  averageScore: "Average Score",
  visitedDate: "Date",
};

export interface UtilityControlsProps {
  trip: PublicTrip;
  section: Section;
  navGroupSlug: string;
  authToken: string | null;
  canContribute: boolean;
  /** Forwarded to AddEntryDialog's own canManage — gates AddFieldSelect
   * inside the Add form (a schema-level change to the section). */
  canManage?: boolean;
  onAdded: (entry: ClientEntry) => void;
  onRequestPairExisting?: (entry: ClientEntry) => void;
  sheetUrl: string | null;
  filterFieldDefs: FieldDef[];
  activeFilters: Set<string>;
  onToggleFilter: (key: string) => void;
  onClearFilters: () => void;
  showRatings: boolean;
  sortBy: SortBy;
  onSortByChange: (v: SortBy) => void;
  searchQuery: string;
  onSearchQueryChange: (v: string) => void;
  /** Marks every active (not archived) entry here Visited in one go —
   * only offered once the trip's actually Completed (see SectionPage),
   * for exactly the case that prompted it: going through and checking
   * off everything by hand after the fact, one at a time, for a trip
   * documented after it already happened. */
  onMarkAllVisited?: () => void;
}

// Off for now — decided against a search box for the time being, but
// SectionPage's whole matching pipeline (searchQuery state, the
// title/group-label matcher, clearing on section nav) is left wired up
// underneath so this is a one-line flip to bring back, not a rebuild.
const SEARCH_ENABLED = false;

type SecondaryActionsProps = {
  sheetHref: string | null;
  filterFieldDefs: FieldDef[];
  activeFilters: Set<string>;
  onToggleFilter: (key: string) => void;
  onClearFilters: () => void;
  showRatings: boolean;
  sortBy: SortBy;
  onSortByChange: (v: SortBy) => void;
  searchQuery: string;
  onSearchQueryChange: (v: string) => void;
  onMarkAllVisited?: () => void;
};

// Sheet / Filter / Sort / Mark-all — everything except +Add. Rendered
// twice (desktop header + mobile drawer) rather than relocated, so
// each surface keeps a stable home; state still lives on SectionPage.
function SecondaryActions({
  sheetHref,
  filterFieldDefs,
  activeFilters,
  onToggleFilter,
  onClearFilters,
  showRatings,
  sortBy,
  onSortByChange,
  searchQuery,
  onSearchQueryChange,
  onMarkAllVisited,
}: SecondaryActionsProps) {
  return (
    <>
      {sheetHref && (
        <Button variant="secondary" size="sm" asChild>
          <a href={sheetHref} target="_blank" rel="noopener noreferrer">
            Google Sheet
          </a>
        </Button>
      )}

      {onMarkAllVisited && (
        <Button variant="secondary" size="sm" onClick={onMarkAllVisited}>
          Mark all Visited
        </Button>
      )}

      {SEARCH_ENABLED && (
        <input
          type="search"
          value={searchQuery}
          onChange={(e) => onSearchQueryChange(e.target.value)}
          placeholder="Search..."
          aria-label="Search this list"
          className={styles["search-input"]}
        />
      )}

      {filterFieldDefs.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="secondary" size="sm">
              Filter{activeFilters.size > 0 ? ` (${activeFilters.size})` : ""}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuLabel>Filter</DropdownMenuLabel>
            {filterFieldDefs.map((f) => (
              <DropdownMenuCheckboxItem
                key={f.key}
                checked={activeFilters.has(f.key)}
                onCheckedChange={() => onToggleFilter(f.key)}
                onSelect={(e) => e.preventDefault()}
              >
                {f.label}
              </DropdownMenuCheckboxItem>
            ))}
            {activeFilters.size > 0 && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={onClearFilters}>Clear all</DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {/* Gated on showRatings alone now — a completed, no-ratings
          section (Food & Drink/Activities) used to show this same
          button with "Date" as its one and only option, which was
          already the default sort there regardless (see SectionPage's
          defaultSortBy) — a menu with nothing else to actually choose
          isn't worth showing. That default sort-by-visited-date
          behavior itself is untouched; only this now-pointless control
          for switching to it (when it's already active) is gone. */}
      {showRatings && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="secondary" size="sm">
              Sort: {SORT_BY_LABELS[sortBy]}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuLabel>Sort by</DropdownMenuLabel>
            <DropdownMenuRadioGroup value={sortBy} onValueChange={(v) => onSortByChange(v as SortBy)}>
              <DropdownMenuRadioItem value="newest">Newest</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="oldest">Oldest</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="myScore">My Score</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="averageScore">Average Score</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </>
  );
}

// Add / Google Sheet / Filter / Sort — everything that isn't the
// entries themselves. Portaled into TripNavHeader's nav row by
// SectionPage (see NavSlot). Completed and in-progress trips share the
// same shape now (bare Google Sheet button, not a gear menu) — "Mark
// all Visited" is just another secondary button when the trip is
// Completed. Below 1024px only +Add stays in the header; Sheet/Sort/
// Filter/Mark-all portal into the burger drawer instead.
export default function UtilityControls({
  trip,
  section,
  navGroupSlug,
  authToken,
  canContribute,
  canManage = false,
  onAdded,
  onRequestPairExisting,
  sheetUrl,
  filterFieldDefs,
  activeFilters,
  onToggleFilter,
  onClearFilters,
  showRatings,
  sortBy,
  onSortByChange,
  searchQuery,
  onSearchQueryChange,
  onMarkAllVisited,
}: UtilityControlsProps) {
  const navSlot = useNavSlot();
  // #gid=<sheet_gid> jumps straight to this section's own tab instead
  // of landing on whichever tab the spreadsheet last had open — null
  // until this section's first export, in which case it just opens the
  // spreadsheet as before.
  const sheetHref = sheetUrl && (section.sheet_gid != null ? `${sheetUrl}#gid=${section.sheet_gid}` : sheetUrl);

  const secondary = (
    <SecondaryActions
      sheetHref={sheetHref}
      filterFieldDefs={filterFieldDefs}
      activeFilters={activeFilters}
      onToggleFilter={onToggleFilter}
      onClearFilters={onClearFilters}
      showRatings={showRatings}
      sortBy={sortBy}
      onSortByChange={onSortByChange}
      searchQuery={searchQuery}
      onSearchQueryChange={onSearchQueryChange}
      onMarkAllVisited={onMarkAllVisited}
    />
  );

  return (
    <>
      {canContribute && (
        <AddEntryDialog
          trip={trip}
          section={section}
          navGroupSlug={navGroupSlug}
          authToken={authToken}
          onAdded={onAdded}
          onRequestPairExisting={section.supports_pairing ? onRequestPairExisting : undefined}
          canManage={canManage}
        />
      )}

      <div className={styles["secondary-desktop"]}>{secondary}</div>

      {navSlot?.mobileActionsSlot && createPortal(<div className={styles["secondary-mobile"]}>{secondary}</div>, navSlot.mobileActionsSlot)}
    </>
  );
}
