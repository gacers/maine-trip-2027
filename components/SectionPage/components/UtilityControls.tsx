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
import type { PublicTrip, Section, ClientEntry, FieldDef } from "@/lib/types";
import styles from "./UtilityControls.module.css";

export type SortBy = "myScore" | "averageScore" | "visitedDate";

export const SORT_BY_LABELS: Record<SortBy, string> = {
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

function GearIcon() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

// Off for now — decided against a search box for the time being, but
// SectionPage's whole matching pipeline (searchQuery state, the
// title/group-label matcher, clearing on section nav) is left wired up
// underneath so this is a one-line flip to bring back, not a rebuild.
const SEARCH_ENABLED = false;

// Add / Google Sheet link / Filter / Sort — everything that isn't the
// entries themselves. Portaled into TripNavHeader's sub-nav row by
// SectionPage itself (see NavSlot); this component doesn't know or
// care where it ends up rendered.
export default function UtilityControls({
  trip,
  section,
  navGroupSlug,
  authToken,
  canContribute,
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
  // #gid=<sheet_gid> jumps straight to this section's own tab instead
  // of landing on whichever tab the spreadsheet last had open — null
  // until this section's first export, in which case it just opens the
  // spreadsheet as before.
  const sheetHref = sheetUrl && (section.sheet_gid != null ? `${sheetUrl}#gid=${section.sheet_gid}` : sheetUrl);

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
        />
      )}

      {/* A completed trip gets the settings menu instead of a bare
          Sheet link — "mark everything visited" is exactly the kind of
          thing that's only useful there (documenting a trip after the
          fact, one entry at a time, is the actual case that prompted
          this), and folding the Sheet link in alongside it means one
          menu instead of an ever-growing row of separate buttons. */}
      {canContribute && trip.completed ? (
        (onMarkAllVisited || sheetHref) && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="secondary" size="sm" aria-label="Section settings">
                <GearIcon />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {onMarkAllVisited && <DropdownMenuItem onSelect={onMarkAllVisited}>Mark all as Visited</DropdownMenuItem>}
              {sheetHref && (
                <DropdownMenuItem asChild>
                  <a href={sheetHref} target="_blank" rel="noopener noreferrer">
                    Google Sheet
                  </a>
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )
      ) : (
        canContribute &&
        sheetHref && (
          <Button variant="secondary" size="sm" asChild>
            <a href={sheetHref} target="_blank" rel="noopener noreferrer">
              Google Sheet
            </a>
          </Button>
        )
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
              <DropdownMenuRadioItem value="myScore">My Score</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="averageScore">Average Score</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </>
  );
}
