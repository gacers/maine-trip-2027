"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import classNames from "classnames";
import PairEntryDialog from "@/components/PairEntryDialog";
import EntryCard from "@/components/EntryCard";
import OverviewMap from "@/components/OverviewMap";
import Button from "@/components/Button";
import Spinner from "@/components/Spinner";
import { useNavSlot } from "@/components/TripNavHeader/NavSlot";
import { groupUnits } from "@/lib/groupUnits";
import { computeTripNights } from "@/lib/fieldTypes/price";
import { captureInviteToken } from "@/lib/inviteClient";
import { useSectionEntries } from "./useSectionEntries";
import UtilityControls, { type SortBy } from "./components/UtilityControls";
import PairedEntryGroup from "./components/PairedEntryGroup";
import type { PublicTrip, Section, ClientEntry, EntryUnit, OverviewPin } from "@/lib/types";
import styles from "./SectionPage.module.css";

// Once a trip is marked completed, what's left to look at is "what did
// we actually do, in what order" rather than "which of these should we
// pick" — Date (visitedDate) reads better as the default than whatever
// this section used for deciding beforehand.
function defaultSortBy(trip: PublicTrip): SortBy {
  return trip.completed ? "visitedDate" : "averageScore";
}

function pinFor(unit: EntryUnit): OverviewPin {
  const primary = unit.listings[0];
  return {
    anchor: unit.type === "group" ? `group-${primary.id}` : `listing-${primary.id}`,
    label: unit.type === "group" ? primary.groupLabel : primary.title,
    lat: primary.lat,
    lng: primary.lng,
  };
}

export interface SectionPageProps {
  trip: PublicTrip;
  section: Section;
  /** This section's own nav group slug — a section's slug is only
   * unique within its group (see migration 0014), so the entries API
   * path needs both: /api/trips/{tripSlug}/sections/{navGroupSlug}/
   * {sectionSlug}/entries. */
  navGroupSlug: string;
  isAdmin?: boolean;
  /** A real, permanent login linked to this trip (see
   * supabase/migrations/0021_trip_editors.sql) — the cross-device
   * alternative to a browser-local contributor token, same edit/
   * archive/no-delete capability either way. */
  isEditor?: boolean;
}

// Replaces CollectionPage.jsx — same fetch/patch/delete/add logic and
// grouping, now against /api/trips/[tripSlug]/sections/[navGroupSlug]/
// [sectionSlug]/entries instead of /api/[collection], and rendering
// whichever fields `section.field_defs` defines instead of a
// hardcoded showBedBath flag.
export default function SectionPage({ trip, section, navGroupSlug, isAdmin = false, isEditor = false }: SectionPageProps) {
  const navSlot = useNavSlot();
  const [showArchived, setShowArchived] = useState(false);
  const [activeFilters, setActiveFilters] = useState<Set<string>>(() => new Set());
  const [searchQuery, setSearchQuery] = useState("");
  // myScore | averageScore | visitedDate — defaults to whichever
  // concept this section actually has.
  const [sortBy, setSortBy] = useState<SortBy>(defaultSortBy(trip));
  const [contributorToken, setContributorToken] = useState<string | null>(null);
  // Which solo entry (if any) is currently mid-"+ Add paired option" —
  // see requestPair below and PairEntryDialog.
  const [pairingEntry, setPairingEntry] = useState<ClientEntry | null>(null);

  const fieldDefs = section.field_defs || [];
  const mapConfig = trip.map_config;
  // `has_map` doubles as "this is a still-deciding-among-options list" —
  // driving times/Closest Town exist to help pick a winner, which a
  // "previous"/already-done section (nothing left to decide) has no use
  // for. It still gets a map, just the plain SimplePlaceMap version
  // (marker + a link to open real Google Maps, no Directions API calls)
  // instead of ListingMap's full comparison tooling — see EntryCard's
  // comparisonMode prop. Off by default for "previous" sections in the
  // Section Designer/starter templates; still a per-section admin
  // toggle either way.
  const comparisonMode = !!section.has_map;
  // Two-score star ratings (My Score / Average Score) — same opt-in
  // pattern, only meaningful for a still-deciding list.
  const showRatings = !!section.supports_ratings;
  // How this section's entries lay out — one full-width card per row,
  // a "small card" two-up, or the tighter "compact card" three-across
  // — a plain per-section choice (see Section Designer), unrelated to
  // comparisonMode. Each also gets its own EntryMedia photo height:
  // list's is the tallest (bigger still for Houses/Stays, see isHouses
  // below), grid-2's own "medium" height sits in between, and grid-3's
  // compact height is the shortest.
  const cardLayout = section.card_layout || "list";
  const isCompactMedia = cardLayout === "grid-3";
  const isMediumMedia = cardLayout === "grid-2";
  const layoutClassName =
    cardLayout === "grid-3" ? styles["entry-grid"] : cardLayout === "grid-2" ? styles["entry-grid-2"] : styles["entry-list"];
  // Stays specifically (identified by nav group, not the card layout)
  // gets a larger photo, more breathing room between cards, and a
  // narrower page overall than the wide 3-across grid other sections
  // use. Every trip's Stays nav group now shares this one slug (a
  // handful of older trips used to carry "houses" instead, from before
  // the category was renamed — normalized directly in the database
  // since nothing else referenced that legacy slug).
  const isHouses = navGroupSlug === "stays";
  // The bigger 20rem photo is specifically list layout's own richer
  // treatment for Houses/Stays — a Houses section explicitly switched
  // to "small"/"compact" (e.g. Stayed Before set to grid-2) chose that
  // smaller size on purpose, so isHouses alone can't drive this or it'd
  // always win out over isMediumMedia/isCompactMedia below.
  const isLargeMedia = isHouses && cardLayout === "list";
  const listClassName = classNames(layoutClassName, isHouses && styles["entry-list-houses"]);
  // Real date range if the trip has one, else its estimated length
  // (see lib/fieldTypes/price.ts) — passed down so a price field's own
  // "total for stay" editor (FieldInput) can bake a real "for N
  // nights" into what gets stored the moment a price is entered.
  const nightsEstimate = computeTripNights(trip);

  // An admin's own session cookie already carries full access — an
  // invite link only matters for everyone else, so it's ignored here if
  // both happen to be present (e.g. the trip owner clicking their own
  // invite link while signed in). Defaulting to false until proven
  // otherwise (rather than assuming access) is deliberate: a visitor
  // gets the Add form, the notes/concerns add button, and the live
  // Google Sheet link only once one of the three real grants — an
  // admin session, an invite param, or a cached invite token — is
  // actually confirmed.
  const canManage = isAdmin;
  // An editor's session cookie already carries their identity server-
  // side (see requireWriteAccess's minRole: "editor") — no bearer token
  // needed, same as an admin, and they may not even have a contributor
  // token in this browser at all (e.g. a fresh device they never used
  // the original invite link on).
  const canContribute = isAdmin || isEditor || !!contributorToken;
  const authToken = isAdmin || isEditor ? null : contributorToken;

  useEffect(() => {
    setContributorToken(captureInviteToken(trip.slug));
  }, [trip.slug]);

  // Houses pages get a slightly darker page background behind the
  // cards (see globals.css's body.houses-page) — toggled on <body>
  // directly since the root layout that actually renders it has no way
  // to know which nested route is active.
  useEffect(() => {
    document.body.classList.toggle("houses-page", isHouses);
    return () => {
      document.body.classList.remove("houses-page");
    };
  }, [isHouses]);

  const { sheetUrl, entries, loading, error, handlePatch, handleDelete, handleRate, handleAdded, clearAllRatings } = useSectionEntries({
    trip,
    section,
    navGroupSlug,
    authToken,
    canContribute,
    showRatings,
  });

  // Filters/search are per-section, not global — clear them when
  // navigating to a different section rather than silently carrying a
  // stale selection (e.g. "Bar" checked, or a search term) into one
  // that doesn't even have that field/those results.
  useEffect(() => {
    setActiveFilters(new Set());
    setSearchQuery("");
    setSortBy(defaultSortBy(trip));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section.id, trip.completed]);

  function toggleFilter(key: string) {
    setActiveFilters((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  // Opens PairEntryDialog for this solo entry — if it doesn't already
  // have a groupLabel (the common case, since a plain solo add never
  // sets one), assign it one on the spot from its own title so there's
  // something for the new paired listing to actually match against
  // (lib/groupUnits.ts pairs purely by two active entries sharing a
  // groupLabel). If it already has one (e.g. its old partner was
  // archived — see groupUnits' comment on that), reuse it as-is.
  function requestPair(entry: ClientEntry) {
    const label = entry.groupLabel?.trim() || entry.title?.trim() || "Option";
    if (!entry.groupLabel?.trim()) {
      handlePatch(entry.id, { groupLabel: label });
    }
    setPairingEntry({ ...entry, groupLabel: label });
  }

  const active = entries.filter((e) => e.status !== "archived").sort((a, b) => (a.rank ?? 999999) - (b.rank ?? 999999));
  const archived = entries.filter((e) => e.status === "archived");

  // Every active entry not already checked off — one at a time via
  // each card's own VisitedControl is exactly right most of the time,
  // but confirmed live as real friction for a trip documented after it
  // already happened (marked Completed once everything was already
  // added, then gone through by hand entry by entry). Skips anything
  // already visited rather than re-patching it — idempotent, and never
  // touches archived entries (never happened, not what this means).
  function markAllVisited() {
    const unvisited = active.filter((e) => !e.visited);
    if (unvisited.length === 0) return;
    if (!window.confirm(`Mark ${unvisited.length} ${unvisited.length === 1 ? "entry" : "entries"} as Visited?`)) return;
    for (const entry of unvisited) {
      handlePatch(entry.id, { visited: true });
    }
  }

  // Any boolean field (e.g. Food & Drink's Restaurant/Bar/Cafe/Breakfast/
  // Lunch/Dinner) doubles as a filter, not just a card badge — generic to
  // whatever a section's own field_defs define, no section-specific code.
  const filterFieldDefs = fieldDefs.filter((f) => f.field_type === "boolean");

  function unitMatchesFilters(unit: EntryUnit): boolean {
    if (activeFilters.size === 0) return true;
    return unit.listings.some((entry) => [...activeFilters].some((key) => !!entry[key]));
  }

  // Matches on title (either half of a pair) or the pair's own shared
  // group label — the two things a unit actually reads as "named" by
  // on the page. Case-insensitive, plain substring — no need for
  // anything fancier at this list size.
  const trimmedQuery = searchQuery.trim().toLowerCase();
  function unitMatchesSearch(unit: EntryUnit): boolean {
    if (!trimmedQuery) return true;
    return unit.listings.some(
      (entry) => entry.title?.toLowerCase().includes(trimmedQuery) || entry.groupLabel?.toLowerCase().includes(trimmedQuery)
    );
  }

  // A 2-item group has two separate scores (one per listing) — sorting by
  // either takes the better of the two, same "at least this good" idea.
  // Date instead takes the earliest of the two (a pair's stay/visit
  // "started" then), and sorts unset last regardless of direction (an
  // unchecked item has no place in a chronological list).
  function unitSortValue(unit: EntryUnit, key: SortBy): number {
    if (key === "visitedDate") {
      const dates = unit.listings
        .map((l) => (l.visitedDate ? new Date(l.visitedDate).getTime() : null))
        .filter((v): v is number => v != null && !Number.isNaN(v));
      return dates.length > 0 ? Math.min(...dates) : Infinity;
    }
    const values = unit.listings.map((l) => l[key] as number | null | undefined).filter((v): v is number => v != null);
    return values.length > 0 ? Math.max(...values) : -Infinity;
  }

  // Date sorts ascending (earliest first) — score-based sorts want the
  // highest first instead.
  const ascendingSort = sortBy === "visitedDate";
  const activeUnits = groupUnits(active)
    .filter((u) => unitMatchesFilters(u) && unitMatchesSearch(u))
    .sort((a, b) =>
      ascendingSort
        ? unitSortValue(a, sortBy) - unitSortValue(b, sortBy)
        : unitSortValue(b, sortBy) - unitSortValue(a, sortBy)
    );
  const pins = activeUnits.map(pinFor);

  // A paired option counts as visited if either half does — practically,
  // marking either listing means "we did this option," not that only
  // one specific half happened.
  function unitIsVisited(unit: EntryUnit): boolean {
    return unit.listings.some((l) => l.visited);
  }
  // Once a trip is completed, the active list splits into "what we
  // actually did" and "researched, didn't get to" — a pure display
  // grouping (keeps activeUnits' own sortBy order within each group),
  // nothing archived to produce it. A still-Pending trip keeps the
  // single flat list (visited isn't even shown yet — see EntryCard's
  // showVisitedControl).
  const visitedUnits = trip.completed ? activeUnits.filter(unitIsVisited) : [];
  const notVisitedUnits = trip.completed ? activeUnits.filter((u) => !unitIsVisited(u)) : activeUnits;

  function renderUnit(unit: EntryUnit) {
    if (unit.type === "group") {
      return (
        <PairedEntryGroup
          key={unit.listings.map((e) => e.id).join("-")}
          unit={unit}
          fieldDefs={fieldDefs}
          mapConfig={mapConfig}
          onPatch={handlePatch}
          onDelete={handleDelete}
          onRate={handleRate}
          canManage={canManage}
          canContribute={canContribute}
          showRatings={showRatings}
          comparisonMode={comparisonMode}
          isCompactMedia={isCompactMedia}
          isLargeMedia={isLargeMedia}
          isMediumMedia={isMediumMedia}
          nightsEstimate={nightsEstimate}
          tripCompleted={trip.completed}
        />
      );
    }
    const entry = unit.listings[0];
    // A solo entry is a full, self-framed card on its own — EntryCard
    // owns its own title/eyebrows/border here, no ListingSection wrapper
    // needed (that's reserved for a 2-house-option group above, which
    // needs one shared frame/header around two otherwise-bare cards).
    return (
      <EntryCard
        key={entry.id}
        entry={entry}
        fieldDefs={fieldDefs}
        mapConfig={mapConfig}
        onPatch={handlePatch}
        onDelete={handleDelete}
        onRate={handleRate}
        canManage={canManage}
        canContribute={canContribute}
        showRatings={showRatings}
        comparisonMode={comparisonMode}
        compact={isCompactMedia}
        largeMedia={isLargeMedia}
        mediumMedia={isMediumMedia}
        supportsPairing={!!section.supports_pairing}
        onAddPaired={canContribute ? () => requestPair(entry) : undefined}
        nightsEstimate={nightsEstimate}
        showVisitedControl={trip.completed}
      />
    );
  }

  // Portaled into TripNavHeader's sub-nav row (see NavSlot) so it reads
  // as part of that sticky bar instead of its own separate row further
  // down the page — falls back to rendering right here (still sticky,
  // still right-aligned) if that slot isn't available for some reason.
  // (Search would also belong in this gate once it's back on — see
  // UtilityControls' SEARCH_ENABLED — since it's useful on any section
  // with more than a couple of entries, unlike Filter/Sort which only
  // mean anything once the section itself opts into a real field/
  // ratings to drive them.)
  const utilityControls = (canContribute || filterFieldDefs.length > 0 || showRatings || trip.completed) && (
      <UtilityControls
        trip={trip}
        section={section}
        navGroupSlug={navGroupSlug}
        authToken={authToken}
        canContribute={canContribute}
        onAdded={handleAdded}
        onRequestPairExisting={section.supports_pairing ? requestPair : undefined}
        sheetUrl={sheetUrl}
        filterFieldDefs={filterFieldDefs}
        activeFilters={activeFilters}
        onToggleFilter={toggleFilter}
        onClearFilters={() => setActiveFilters(new Set())}
        showRatings={showRatings}
        sortBy={sortBy}
        onSortByChange={setSortBy}
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
        onMarkAllVisited={trip.completed ? markAllVisited : undefined}
      />
    );

  return (
    <main className={classNames(styles["root"], isHouses && styles["root-houses"])}>
      {/* No hint that a Sheet even exists for a non-contributor — Request
          Access itself now lives once, globally, in TripNavHeader. Add/
          Sheet/Filter/Sort all live together in utilityControls now,
          instead of the Add form always sitting open at the top of the
          page whether or not anyone's about to use it. */}
      {pairingEntry && (
        <PairEntryDialog
          trip={trip}
          section={section}
          navGroupSlug={navGroupSlug}
          authToken={authToken}
          presetGroupLabel={pairingEntry.groupLabel || ""}
          open={!!pairingEntry}
          onOpenChange={(o) => !o && setPairingEntry(null)}
          onAdded={(entry) => {
            handleAdded(entry);
            // This pair just formed for the first time — neither half's
            // old score (if either had one, from before pairing) means
            // anything as a rating of the option now shared between
            // them. See clearAllRatings.
            if (showRatings) {
              clearAllRatings(entry.id);
              clearAllRatings(pairingEntry.id);
            }
          }}
          onSaveComplete={() => setPairingEntry(null)}
        />
      )}

      {utilityControls &&
        (navSlot?.slot ? createPortal(utilityControls, navSlot.slot) : <div className={styles["utility-row"]}>{utilityControls}</div>)}

      {error && <p className={styles["error-banner"]}>{error}</p>}

      {isAdmin && section.sheet_sync_error && (
        <p className={styles["error-banner"]}>
          This section&apos;s Google Sheet fell out of sync: {section.sheet_sync_error} — try &quot;Re-export all
          sections now&quot; from the Invite Links admin panel.
        </p>
      )}

      {loading ? (
        <div className={styles["loading-wrap"]}>
          <Spinner size={48} />
        </div>
      ) : (
        <>
          {/* Independent of comparisonMode on purpose — OverviewMap is a
              plain "everything on one map, click a pin to jump to it"
              index, not the driving-times/Closest Town comparison
              tooling that flag actually governs. Every section with
              located entries gets one, "previous" included. */}
          {!loading && activeUnits.length > 0 && <OverviewMap pins={pins} />}

          {activeUnits.length === 0 && (
            <p className={styles["empty-text"]}>
              {active.length === 0 ? section.empty_message : "Nothing matches the selected filters/search."}
            </p>
          )}
          {/* Split into Visited/Researched headings only when there's
              actually something on both sides to contrast — a
              completed trip where everything (or nothing) ended up
              visited has nothing to distinguish, and the heading just
              read as a redundant label sitting above the one list that
              already is the whole thing (confirmed live). Falls back to
              the exact same flat list either way. */}
          {trip.completed && visitedUnits.length > 0 && notVisitedUnits.length > 0 ? (
            <>
              <div className={styles["completion-group"]}>
                <h2 className={styles["group-heading"]}>{section.supports_pairing ? "Where You Stayed" : "Visited"}</h2>
                <div className={listClassName}>{visitedUnits.map(renderUnit)}</div>
              </div>
              <div className={styles["completion-group"]}>
                <h2 className={styles["group-heading"]}>Researched — Not Visited</h2>
                <div className={listClassName}>{notVisitedUnits.map(renderUnit)}</div>
              </div>
            </>
          ) : (
            <div className={listClassName}>{activeUnits.map(renderUnit)}</div>
          )}

          {archived.length > 0 && (
            <div className={styles["archived-section"]}>
              <Button variant="ghost" size="sm" onClick={() => setShowArchived((v) => !v)}>
                {showArchived ? "Hide" : "Show"} archived ({archived.length})
              </Button>
              {showArchived && (
                <div className={classNames(listClassName, styles["archived-list"])}>
                  {groupUnits(archived)
                    .filter((u) => unitMatchesFilters(u) && unitMatchesSearch(u))
                    .map(renderUnit)}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </main>
  );
}
