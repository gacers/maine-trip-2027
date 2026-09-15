"use client";

import { useEffect, useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { createPortal } from "react-dom";
import AddEntryDialog from "@/components/AddEntryDialog";
import PairEntryDialog from "@/components/PairEntryDialog";
import EntryCard from "@/components/EntryCard";
import EntryMedia from "@/components/EntryMedia";
import ListingSection from "@/components/ListingSection";
import { useNavSlot } from "@/components/TripNavHeader/NavSlot";
import GroupMap from "@/components/GroupMap";
import SimpleGroupMap from "@/components/SimpleGroupMap";
import OverviewMap from "@/components/OverviewMap";
import Button from "@/components/Button";
import Spinner from "@/components/Spinner";
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
import { groupUnits } from "@/lib/groupUnits";
import { computeTripNights } from "@/lib/fieldTypes/price";
import { captureInviteToken, getOrCreateDeviceId } from "@/lib/inviteClient";
import type { PublicTrip, Section, ClientEntry, EntryUnit, OverviewPin } from "@/lib/types";
import styles from "./SectionPage.module.css";

type SortBy = "rank" | "myScore" | "averageScore" | "visitedDate";

const SORT_BY_LABELS: Record<SortBy, string> = {
  rank: "Rank",
  myScore: "My Score",
  averageScore: "Average Score",
  visitedDate: "Date",
};

// Admins just name the pair itself ("Gouldsboro") — this appends the
// "- 2 House Option" suffix so it's never on them to type/remember it
// consistently. Guards against double-appending for any group whose
// stored label already has it from before this was automatic.
const GROUP_SUFFIX = "2 House Option";
function groupTitle(label: string | null | undefined): string {
  const base = (label || "").trim();
  return base.toLowerCase().endsWith(GROUP_SUFFIX.toLowerCase()) ? base : `${base} - ${GROUP_SUFFIX}`;
}

// Once a trip is marked completed, what's left to look at is "what did
// we actually do, in what order" rather than "which of these should we
// pick" — Date (visitedDate) reads better as the default than whatever
// this section used for deciding beforehand.
function defaultSortBy(trip: PublicTrip, section: Section): SortBy {
  if (trip.completed) return "visitedDate";
  return section.supports_ranking ? "rank" : "averageScore";
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
}

// Replaces CollectionPage.jsx — same fetch/patch/delete/add logic and
// grouping, now against /api/trips/[tripSlug]/sections/[navGroupSlug]/
// [sectionSlug]/entries instead of /api/[collection], and rendering
// whichever fields `section.field_defs` defines instead of a
// hardcoded showBedBath flag.
export default function SectionPage({ trip, section, navGroupSlug, isAdmin = false }: SectionPageProps) {
  const navSlot = useNavSlot();
  const queryClient = useQueryClient();
  // Only ever set by a mutation's own catch block below — the entries
  // query's own fetch error surfaces separately (see `error` further
  // down), this is just for a patch/delete/rate that failed after
  // already being applied optimistically.
  const [mutationError, setMutationError] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [activeFilters, setActiveFilters] = useState<Set<string>>(() => new Set());
  // rank | myScore | averageScore — defaults to whichever concept this
  // section actually has; Rank only exists as an option at all once
  // supports_ranking is on.
  const [sortBy, setSortBy] = useState<SortBy>(defaultSortBy(trip, section));
  const [contributorToken, setContributorToken] = useState<string | null>(null);
  // Which solo entry (if any) is currently mid-"+ Add paired option" —
  // see requestPair below and PairEntryDialog.
  const [pairingEntry, setPairingEntry] = useState<ClientEntry | null>(null);

  const apiBase = `/api/trips/${trip.slug}/sections/${navGroupSlug}/${section.slug}/entries`;
  const fieldDefs = section.field_defs || [];
  const mapConfig = trip.map_config;
  // `has_map` doubles as "this is a still-deciding-among-options list" —
  // ranking and driving times/Closest Town exist to help pick a winner,
  // which a "previous"/already-done section (nothing left to decide) has
  // no use for. It still gets a map, just the plain SimplePlaceMap
  // version (marker + a link to open real Google Maps, no Directions API
  // calls) instead of ListingMap's full comparison tooling — see
  // EntryCard's comparisonMode prop. Off by default for "previous"
  // sections in the Section Designer/starter templates; still a
  // per-section admin toggle either way.
  const comparisonMode = !!section.has_map;
  // Whether to show the manual Rank input/reordering at all — its own
  // toggle, decoupled from comparisonMode/has_map (which is about map
  // complexity, not ranking). Only a still-deciding-among-options list
  // like Possible Houses needs it; per-section admin toggle either way.
  const showRanking = !!section.supports_ranking;
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
    cardLayout === "grid-3" ? styles.entryGrid : cardLayout === "grid-2" ? styles.entryGrid2 : styles.entryList;
  // Houses/Stays specifically (identified by nav group, not the card
  // layout) get a larger photo, more breathing room between cards, and
  // a narrower page overall than the wide 3-across grid other sections
  // use. "stays" is the slug a *new* trip's version of this group gets
  // now (see lib/sectionTemplates.ts) — "houses" stays checked too
  // since existing trips keep their original slug (renaming a nav
  // group's label doesn't change its URL out from under anyone).
  const isHouses = navGroupSlug === "houses" || navGroupSlug === "stays";
  // The bigger 20rem photo is specifically list layout's own richer
  // treatment for Houses/Stays — a Houses section explicitly switched
  // to "small"/"compact" (e.g. Stayed Before set to grid-2) chose that
  // smaller size on purpose, so isHouses alone can't drive this or it'd
  // always win out over isMediumMedia/isCompactMedia below.
  const isLargeMedia = isHouses && cardLayout === "list";
  const listClassName = [layoutClassName, isHouses && styles.entryListHouses].filter(Boolean).join(" ");
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
  const canContribute = isAdmin || !!contributorToken;
  const authToken = isAdmin ? null : contributorToken;

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

  function authHeaders(): Record<string, string> {
    // X-Rater-Device always goes along for the ride — harmless for any
    // route that ignores it, and it's what lets a contributor's own
    // score be told apart from another person sharing the same invite
    // link (see lib/ratings.ts's resolveRaterKey). Ignored for an admin,
    // whose real login is already a stable identity of its own.
    const headers: Record<string, string> = authToken ? { Authorization: `Bearer ${authToken}` } : {};
    headers["X-Rater-Device"] = getOrCreateDeviceId();
    return headers;
  }

  // Fetched separately (not handed down in trip's own props) once access
  // is confirmed — see /api/trips/[tripSlug]/sheet-url and
  // sanitizeTripForClient for why this can't just be trip.google_sheet_url.
  // A real useQuery (not a plain effect) so it's cached across a nav
  // away and back, same reasoning as the entries query below.
  const sheetUrlQuery = useQuery({
    queryKey: ["sheetUrl", trip.slug, authToken] as const,
    queryFn: async () => {
      const res = await fetch(`/api/trips/${trip.slug}/sheet-url`, { headers: authHeaders() });
      if (!res.ok) return null; // non-fatal — worst case the Google Sheet pill just doesn't show
      const data = await res.json();
      return (data?.googleSheetUrl as string | undefined) ?? null;
    },
    enabled: canContribute,
  });
  const sheetUrl = sheetUrlQuery.data ?? null;

  // The entries list itself — the one query on this page that's worth
  // real caching. A plain per-mount fetch (what this used to be) means
  // clicking Food & Drink -> Activities -> back to Food & Drink re-hits
  // the server for data that hasn't changed; this keys the cache by
  // exactly what identifies "this data" (which trip/group/section, and
  // which caller — authToken affects each entry's own myScore) so that
  // round trip is skipped within staleTime (see QueryProvider), while
  // refetchOnWindowFocus/reconnect (also set there) still catches up on
  // another contributor's edits within a normal browsing session.
  const entriesQueryKey = ["entries", trip.slug, navGroupSlug, section.slug, authToken] as const;
  const entriesQuery = useQuery({
    queryKey: entriesQueryKey,
    queryFn: async () => {
      // Needs authHeaders() (not just a plain fetch) so a section with
      // ratings on can resolve *this caller's* myScore, not just the
      // public average.
      const res = await fetch(apiBase, { cache: "no-store", headers: authHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load entries");
      return data.entries as ClientEntry[];
    },
  });
  const entries = entriesQuery.data ?? [];
  // isPending (no cached data at all yet) is the only case that should
  // still show the full-page spinner — a background refetch (isFetching
  // but already-cached data present) should just quietly swap in when
  // it resolves, not flash the whole section back to a spinner.
  const loading = entriesQuery.isPending;
  const error = mutationError || (entriesQuery.isError ? (entriesQuery.error as Error).message : "");

  function applyLocalPatch(id: string, patch: Partial<ClientEntry>) {
    queryClient.setQueryData<ClientEntry[]>(entriesQueryKey, (old) => old?.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  }

  // Filters are per-section, not global — clear them when navigating to a
  // different section rather than silently carrying a stale selection
  // (e.g. "Bar" checked) into one that doesn't even have that field.
  useEffect(() => {
    setActiveFilters(new Set());
    setSortBy(defaultSortBy(trip, section));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section.id, section.supports_ranking, trip.completed]);

  function toggleFilter(key: string) {
    setActiveFilters((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  // Every mutation below follows the same shape: a plain useMutation
  // wrapping the fetch itself (no onMutate/onSuccess — the optimistic
  // write and any rollback live in each mutation's own calling
  // function, since a couple of these have side effects, like
  // handlePatch's status-change check, that plain mutation callbacks
  // don't fit well), and on failure a real invalidateQueries so the
  // cache gets a fresh server read instead of staying wrong under a
  // swallowed error.
  const clearRatingsMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`${apiBase}/${id}/ratings?all=true`, { method: "DELETE", headers: authHeaders() });
      if (!res.ok) throw new Error("Couldn't clear ratings");
    },
  });

  // Wipes *every* rater's score for this entry (not just the caller's
  // own — see handleRate below for that). Used whenever an entry's
  // pairing composition just changed (see handlePatch's status-change
  // check and requestPair): a house's score as a solo listing and its
  // score as half of a 2-house option aren't the same thing, so
  // whatever was rated under the old shape shouldn't silently carry
  // over as if it were rated under the new one.
  async function clearAllRatings(id: string) {
    applyLocalPatch(id, { myScore: null, averageScore: null, ratingCount: 0 }); // optimistic
    try {
      await clearRatingsMutation.mutateAsync(id);
    } catch (err) {
      setMutationError((err as Error).message);
      queryClient.invalidateQueries({ queryKey: entriesQueryKey });
    }
  }

  const patchMutation = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Record<string, unknown> }) => {
      const res = await fetch(`${apiBase}/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error("Update failed");
      return (await res.json()).entry as ClientEntry;
    },
  });

  async function handlePatch(id: string, patch: Record<string, unknown>) {
    // Captured before the optimistic update below, so a status change
    // on `id` itself doesn't affect what we see here for its partner.
    const beforeEntry = entries.find((e) => e.id === id);
    applyLocalPatch(id, patch as Partial<ClientEntry>); // optimistic
    try {
      const updated = await patchMutation.mutateAsync({ id, patch });
      applyLocalPatch(id, updated);

      // Archiving or restoring `id` may have just broken up a pair (the
      // surviving half goes back to being scored as a solo house) or
      // reformed one (both halves go back to being scored as one
      // option) — either way, whatever score(s) existed under the old
      // shape get cleared. See clearAllRatings above.
      if (showRatings && typeof patch.status === "string" && beforeEntry?.groupLabel) {
        const partner = entries.find(
          (e) => e.id !== id && e.groupLabel === beforeEntry.groupLabel && e.status !== "archived"
        );
        if (partner && patch.status === "archived") {
          clearAllRatings(partner.id);
        } else if (partner && patch.status === "active") {
          clearAllRatings(id);
          clearAllRatings(partner.id);
        }
      }
    } catch (err) {
      setMutationError((err as Error).message);
      queryClient.invalidateQueries({ queryKey: entriesQueryKey });
    }
  }

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`${apiBase}/${id}`, { method: "DELETE", headers: authHeaders() });
      if (!res.ok) throw new Error("Delete failed");
    },
  });

  async function handleDelete(id: string) {
    const previous = entries;
    queryClient.setQueryData<ClientEntry[]>(entriesQueryKey, (old) => old?.filter((e) => e.id !== id));
    try {
      await deleteMutation.mutateAsync(id);
    } catch (err) {
      setMutationError((err as Error).message);
      queryClient.setQueryData(entriesQueryKey, previous);
      queryClient.invalidateQueries({ queryKey: entriesQueryKey });
    }
  }

  const rateMutation = useMutation({
    mutationFn: async ({ id, score }: { id: string; score: number | null }) => {
      const res =
        score == null
          ? await fetch(`${apiBase}/${id}/ratings`, { method: "DELETE", headers: authHeaders() })
          : await fetch(`${apiBase}/${id}/ratings`, {
              method: "PUT",
              headers: { "Content-Type": "application/json", ...authHeaders() },
              body: JSON.stringify({ score }),
            });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Rating failed");
      return data;
    },
  });

  async function handleRate(id: string, score: number | null) {
    applyLocalPatch(id, { myScore: score }); // optimistic
    try {
      const data = await rateMutation.mutateAsync({ id, score });
      applyLocalPatch(id, data);
    } catch (err) {
      setMutationError((err as Error).message);
      queryClient.invalidateQueries({ queryKey: entriesQueryKey });
    }
  }

  // AddEntryDialog/PairEntryDialog do their own POST and hand back the
  // finished entry — this just needs to land it in the same cache the
  // entries query itself reads from.
  function handleAdded(entry: ClientEntry) {
    queryClient.setQueryData<ClientEntry[]>(entriesQueryKey, (old) => [...(old ?? []), entry]);
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

  // Any boolean field (e.g. Food & Drink's Restaurant/Bar/Cafe/Breakfast/
  // Lunch/Dinner) doubles as a filter, not just a card badge — generic to
  // whatever a section's own field_defs define, no section-specific code.
  const filterFieldDefs = fieldDefs.filter((f) => f.field_type === "boolean");

  function unitMatchesFilters(unit: EntryUnit): boolean {
    if (activeFilters.size === 0) return true;
    return unit.listings.some((entry) => [...activeFilters].some((key) => !!entry[key]));
  }

  // A 2-item group has two separate scores (one per listing) — sorting by
  // either takes the better of the two, same "at least this good" idea
  // as picking a representative rank for the pair. Date instead takes
  // the earliest of the two (a pair's stay/visit "started" then), and
  // sorts unset last regardless of direction (an unchecked item has no
  // place in a chronological list).
  function unitSortValue(unit: EntryUnit, key: SortBy): number {
    if (key === "rank") return unit.listings[0]?.rank ?? 999999;
    if (key === "visitedDate") {
      const dates = unit.listings
        .map((l) => (l.visitedDate ? new Date(l.visitedDate).getTime() : null))
        .filter((v): v is number => v != null && !Number.isNaN(v));
      return dates.length > 0 ? Math.min(...dates) : Infinity;
    }
    const values = unit.listings.map((l) => l[key] as number | null | undefined).filter((v): v is number => v != null);
    return values.length > 0 ? Math.max(...values) : -Infinity;
  }

  // Rank and Date both sort ascending (lowest/earliest first) — score-
  // based sorts want the highest first instead.
  const ascendingSort = sortBy === "rank" || sortBy === "visitedDate";
  const activeUnits = groupUnits(active)
    .filter(unitMatchesFilters)
    .sort((a, b) =>
      ascendingSort
        ? unitSortValue(a, sortBy) - unitSortValue(b, sortBy)
        : unitSortValue(b, sortBy) - unitSortValue(a, sortBy)
    );
  const pins = activeUnits.map(pinFor);

  function renderUnit(unit: EntryUnit) {
    if (unit.type === "group") {
      return (
        <ListingSection
          key={unit.listings.map((e) => e.id).join("-")}
          id={`group-${unit.listings[0].id}`}
          title={groupTitle(unit.listings[0].groupLabel)}
          media={
            <div className={styles.groupMediaRow}>
              {unit.listings.map((entry) => (
                <div key={entry.id} className={styles.groupMediaHalf}>
                  <EntryMedia
                    entry={entry}
                    compact={isCompactMedia}
                    large={isLargeMedia}
                    medium={isMediumMedia}
                    showRatings={showRatings}
                  />
                </div>
              ))}
            </div>
          }
          rank={canManage && showRanking ? unit.listings[0].rank ?? undefined : undefined}
          onRankChange={(newRank) => unit.listings.forEach((e) => handlePatch(e.id, { rank: newRank }))}
          canManage={canManage}
          showRatings={showRatings}
          canContribute={canContribute}
          myScore={unit.listings[0].myScore ?? null}
          onRate={(score) => unit.listings.forEach((e) => handleRate(e.id, score))}
          onDeleteGroup={
            unit.listings[0].status === "archived"
              ? null
              : (reason) => unit.listings.forEach((e) => handlePatch(e.id, { archiveReason: reason, status: "archived" }))
          }
        >
          <div className={styles.groupListings}>
            {unit.listings.map((entry) => (
              <div key={entry.id} className={styles.groupListingHalf}>
                <EntryCard
                  entry={entry}
                  fieldDefs={fieldDefs}
                  mapConfig={mapConfig}
                  onPatch={handlePatch}
                  onDelete={handleDelete}
                  onRate={handleRate}
                  canManage={canManage}
                  canContribute={canContribute}
                  bare
                  hideMedia
                  showRank={false}
                  showRatings={showRatings}
                  showRatingControl={false}
                  showMap={false}
                  compact={isCompactMedia}
                  mediumMedia={isMediumMedia}
                  nightsEstimate={nightsEstimate}
                  showVisitedControl={trip.completed}
                />
              </div>
            ))}
          </div>
          {comparisonMode ? (
            <GroupMap listings={unit.listings} mapConfig={mapConfig} />
          ) : (
            <div className={styles.groupMapSection}>
              <SimpleGroupMap listings={unit.listings} />
            </div>
          )}
        </ListingSection>
      );
    }
    const entry = unit.listings[0];
    // A solo entry is a full, self-framed card on its own — EntryCard
    // owns its own title/eyebrows/border here, no ListingSection wrapper
    // needed (that's reserved for a 2-house-option group below, which
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
        showRank={showRanking}
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
  // The Google Sheet link lives here too now, alongside Filter/Sort,
  // instead of its own centered row further down the page.
  const utilityControls = (canContribute || filterFieldDefs.length > 0 || showRatings || trip.completed) && (
    <>
      {canContribute && (
        <AddEntryDialog
          trip={trip}
          section={section}
          navGroupSlug={navGroupSlug}
          authToken={authToken}
          onAdded={handleAdded}
          onRequestPairExisting={section.supports_pairing ? requestPair : undefined}
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
                onCheckedChange={() => toggleFilter(f.key)}
                onSelect={(e) => e.preventDefault()}
              >
                {f.label}
              </DropdownMenuCheckboxItem>
            ))}
            {activeFilters.size > 0 && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => setActiveFilters(new Set())}>Clear all</DropdownMenuItem>
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
            <DropdownMenuRadioGroup value={sortBy} onValueChange={(v) => setSortBy(v as SortBy)}>
              {showRanking && <DropdownMenuRadioItem value="rank">Rank</DropdownMenuRadioItem>}
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

  return (
    <main className={[styles.main, isHouses && styles.mainHouses].filter(Boolean).join(" ")}>
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
            setPairingEntry(null);
          }}
        />
      )}

      {utilityControls && (navSlot?.slot ? createPortal(utilityControls, navSlot.slot) : <div className={styles.utilityRow}>{utilityControls}</div>)}

      {error && <p className={styles.errorBanner}>{error}</p>}

      {loading ? (
        <div className={styles.loadingWrap}>
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
            <p className={styles.emptyText}>{active.length === 0 ? section.empty_message : "Nothing matches the selected filters."}</p>
          )}
          <div className={listClassName}>{activeUnits.map(renderUnit)}</div>

          {archived.length > 0 && (
            <div className={styles.archivedSection}>
              <Button variant="ghost" size="sm" onClick={() => setShowArchived((v) => !v)}>
                {showArchived ? "Hide" : "Show"} archived ({archived.length})
              </Button>
              {showArchived && (
                <div className={`${listClassName} ${styles.archivedList}`}>
                  {groupUnits(archived).filter(unitMatchesFilters).map(renderUnit)}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </main>
  );
}
