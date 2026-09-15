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
}

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
}: UtilityControlsProps) {
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

      {canContribute && sheetUrl && (
        <Button variant="secondary" size="sm" asChild>
          {/* #gid=<sheet_gid> jumps straight to this section's own tab
              instead of landing on whichever tab the spreadsheet last
              had open — null until this section's first export, in
              which case it just opens the spreadsheet as before. */}
          <a
            href={section.sheet_gid != null ? `${sheetUrl}#gid=${section.sheet_gid}` : sheetUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            Google Sheet
          </a>
        </Button>
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

      {(showRatings || trip.completed) && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="secondary" size="sm">
              Sort: {SORT_BY_LABELS[sortBy]}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuLabel>Sort by</DropdownMenuLabel>
            <DropdownMenuRadioGroup value={sortBy} onValueChange={(v) => onSortByChange(v as SortBy)}>
              {showRatings && <DropdownMenuRadioItem value="myScore">My Score</DropdownMenuRadioItem>}
              {showRatings && <DropdownMenuRadioItem value="averageScore">Average Score</DropdownMenuRadioItem>}
              {/* Only meaningful once a trip is completed — beforehand
                  nothing has a visitedDate to sort by yet. */}
              {trip.completed && <DropdownMenuRadioItem value="visitedDate">Date</DropdownMenuRadioItem>}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </>
  );
}
