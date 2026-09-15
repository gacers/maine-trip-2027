import { useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { getOrCreateDeviceId } from "@/lib/inviteClient";
import type { PublicTrip, Section, ClientEntry } from "@/lib/types";

export interface UseSectionEntriesArgs {
  trip: PublicTrip;
  section: Section;
  navGroupSlug: string;
  authToken: string | null;
  /** isAdmin || a resolved contributor token — an admin's authToken is
   * always null (their session cookie carries access instead), so
   * `authToken` alone can't tell "admin" and "no access yet" apart. */
  canContribute: boolean;
  showRatings: boolean;
}

// The entries list itself, its Google Sheet link, and every mutation
// that touches either — split out of SectionPage so its own render
// logic isn't tangled up with the query/cache plumbing. See each
// query/mutation below for why it's shaped the way it is; the short
// version is in SectionPage's git history if this file's own comments
// aren't enough context.
export function useSectionEntries({ trip, section, navGroupSlug, authToken, canContribute, showRatings }: UseSectionEntriesArgs) {
  const queryClient = useQueryClient();
  // Only ever set by a mutation's own catch block below — the entries
  // query's own fetch error surfaces separately, this is just for a
  // patch/delete/rate that failed after already being applied
  // optimistically.
  const [mutationError, setMutationError] = useState("");

  const apiBase = `/api/trips/${trip.slug}/sections/${navGroupSlug}/${section.slug}/entries`;

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
  // check and SectionPage's own requestPair): a house's score as a solo
  // listing and its score as half of a 2-house option aren't the same
  // thing, so whatever was rated under the old shape shouldn't silently
  // carry over as if it were rated under the new one.
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

  return {
    sheetUrl: sheetUrlQuery.data ?? null,
    entries,
    loading,
    error,
    handlePatch,
    handleDelete,
    handleRate,
    handleAdded,
    clearAllRatings,
  };
}
