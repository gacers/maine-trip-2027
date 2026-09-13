"use client";

import { useEffect, useState } from "react";
import AddEntryForm from "@/components/AddEntryForm";
import RequestAccess from "@/components/RequestAccess";
import EntryCard from "@/components/EntryCard";
import ListingSection from "@/components/ListingSection";
import GroupMap from "@/components/GroupMap";
import SimpleGroupMap from "@/components/SimpleGroupMap";
import OverviewMap from "@/components/OverviewMap";
import { groupUnits } from "@/lib/groupUnits";
import { captureInviteToken, captureAddUrl } from "@/lib/inviteClient";
import { buildAgentInstructions, downloadTextFile } from "@/lib/agentInstructions";

function pinFor(unit) {
  const primary = unit.listings[0];
  return {
    anchor: unit.type === "group" ? `group-${primary.id}` : `listing-${primary.id}`,
    label: unit.type === "group" ? primary.groupLabel : primary.title,
    lat: primary.lat,
    lng: primary.lng,
  };
}

// Replaces CollectionPage.jsx — same fetch/patch/delete/add logic and
// grouping, now against /api/trips/[tripSlug]/sections/[sectionSlug]/
// entries instead of /api/[collection], and rendering whichever fields
// `section.field_defs` defines instead of a hardcoded showBedBath flag.
export default function SectionPage({ trip, section, isAdmin = false, contactEmail = null }) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [contributorToken, setContributorToken] = useState(null);
  const [pendingAddUrl, setPendingAddUrl] = useState(null);
  // Whether the localStorage/invite-param check below has actually run
  // yet. An admin's access is already known synchronously from the
  // server (the isAdmin prop), so there's nothing to wait for; everyone
  // else's real status depends on reading localStorage client-side,
  // which can't happen before mount. Gating "Request access" on this
  // (rather than just `!canContribute`) stops it from flashing on for a
  // returning contributor whose token just hasn't been read back yet.
  const [accessChecked, setAccessChecked] = useState(isAdmin);

  const apiBase = `/api/trips/${trip.slug}/sections/${section.slug}/entries`;
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
  // Houses get one full-width card per row; lighter entries (food &
  // drink, activities) read better two to a row — a plain per-section
  // layout toggle, unrelated to comparisonMode.
  const compactCards = !!section.compact_cards;
  const listClassName = compactCards ? "grid grid-cols-1 sm:grid-cols-2 gap-4" : "flex flex-col gap-4";

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
  const showRequestAccess = accessChecked && !canContribute;

  useEffect(() => {
    setContributorToken(captureInviteToken(trip.slug));
    setPendingAddUrl(captureAddUrl());
    setAccessChecked(true);
  }, [trip.slug]);

  function authHeaders() {
    return authToken ? { Authorization: `Bearer ${authToken}` } : {};
  }

  async function load() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(apiBase, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load entries");
      setEntries(data.entries);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiBase]);

  function applyLocalPatch(id, patch) {
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  }

  async function handlePatch(id, patch) {
    applyLocalPatch(id, patch); // optimistic
    try {
      const res = await fetch(`${apiBase}/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error("Update failed");
      const data = await res.json();
      applyLocalPatch(id, data.entry);
    } catch (err) {
      setError(err.message);
      load(); // re-sync on failure
    }
  }

  async function handleDelete(id) {
    setEntries((prev) => prev.filter((e) => e.id !== id));
    try {
      const res = await fetch(`${apiBase}/${id}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error("Delete failed");
    } catch (err) {
      setError(err.message);
      load();
    }
  }

  function handleAdded(entry) {
    setEntries((prev) => [...prev, entry]);
  }

  async function handleDownloadInstructions() {
    // A contributor already has their own (add/append-only) token —
    // reuse it. An admin has no bearer token at all (their access is
    // the session cookie), so mint a fresh full-access owner key on the
    // spot rather than sending them to the API Keys admin page first.
    if (contributorToken) {
      const text = buildAgentInstructions({
        trip,
        section,
        siteUrl: window.location.origin,
        token: contributorToken,
        role: "contributor",
      });
      downloadTextFile(`${trip.slug}-agent-instructions.md`, text);
      return;
    }

    try {
      const res = await fetch(`/api/trips/${trip.slug}/api-keys`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: "Downloaded agent instructions", role: "owner" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't create a key");
      const text = buildAgentInstructions({
        trip,
        section,
        siteUrl: window.location.origin,
        token: data.token,
        role: "owner",
      });
      downloadTextFile(`${trip.slug}-agent-instructions.md`, text);
    } catch (err) {
      setError(err.message);
    }
  }

  const active = entries
    .filter((e) => e.status !== "archived")
    .sort((a, b) => (a.rank ?? 999999) - (b.rank ?? 999999));
  const archived = entries.filter((e) => e.status === "archived");

  const activeUnits = groupUnits(active);
  const pins = activeUnits.map(pinFor);

  function renderUnit(unit) {
    if (unit.type === "group") {
      return (
        <ListingSection
          key={unit.listings.map((e) => e.id).join("-")}
          id={`group-${unit.listings[0].id}`}
          title={unit.listings[0].groupLabel}
          rank={canManage && comparisonMode ? unit.listings[0].rank ?? undefined : undefined}
          onRankChange={(newRank) =>
            unit.listings.forEach((e) => handlePatch(e.id, { rank: newRank }))
          }
        >
          <div className="flex flex-col sm:flex-row gap-4 sm:gap-5">
            {unit.listings.map((entry) => (
              <div key={entry.id} className="sm:w-1/2 min-w-0">
                <EntryCard
                  entry={entry}
                  fieldDefs={fieldDefs}
                  mapConfig={mapConfig}
                  onPatch={handlePatch}
                  onDelete={handleDelete}
                  canManage={canManage}
                  canContribute={canContribute}
                  bare
                  showRank={false}
                  showMap={false}
                />
              </div>
            ))}
          </div>
          {comparisonMode ? (
            <GroupMap listings={unit.listings} mapConfig={mapConfig} />
          ) : (
            <SimpleGroupMap listings={unit.listings} />
          )}
        </ListingSection>
      );
    }
    const entry = unit.listings[0];
    return (
      <ListingSection key={entry.id} title={entry.title} href={entry.url}>
        <EntryCard
          entry={entry}
          fieldDefs={fieldDefs}
          mapConfig={mapConfig}
          onPatch={handlePatch}
          onDelete={handleDelete}
          canManage={canManage}
          canContribute={canContribute}
          bare
          showTitle={false}
          showRank={comparisonMode}
          comparisonMode={comparisonMode}
        />
      </ListingSection>
    );
  }

  return (
    <main className="max-w-4xl mx-auto px-4 pb-16 flex flex-col gap-6 w-full">
      <div className="flex justify-center">
        {trip.google_sheet_url &&
          (canContribute ? (
            <a
              href={trip.google_sheet_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-zinc-300 bg-white px-4 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
            >
              Google Sheet
            </a>
          ) : (
            <span
              title="Request access first to view the Google Sheet"
              className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-zinc-50 px-4 py-1.5 text-sm font-medium text-zinc-400 cursor-not-allowed select-none"
            >
              Google Sheet
            </span>
          ))}
      </div>

      {canContribute && (
        <div className="flex flex-col gap-2">
          <AddEntryForm
            trip={trip}
            section={section}
            onAdded={handleAdded}
            authToken={authToken}
            initialUrl={pendingAddUrl}
          />
          <button
            onClick={handleDownloadInstructions}
            className="text-sm text-zinc-500 hover:underline self-start"
          >
            Download agent instructions (add via your own AI agent instead)
          </button>
        </div>
      )}

      {showRequestAccess && <RequestAccess trip={trip} section={section} contactEmail={contactEmail} />}

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-2">{error}</p>
      )}

      {loading ? (
        <p className="text-zinc-500 text-sm">Loading...</p>
      ) : (
        <>
          {/* Independent of comparisonMode on purpose — OverviewMap is a
              plain "everything on one map, click a pin to jump to it"
              index, not the driving-times/Closest Town comparison
              tooling that flag actually governs. Every section with
              located entries gets one, "previous" included. */}
          {!loading && active.length > 0 && <OverviewMap pins={pins} />}

          {active.length === 0 && (
            <p className="text-zinc-500 text-sm">{section.empty_message}</p>
          )}
          <div className={listClassName}>{activeUnits.map(renderUnit)}</div>

          {archived.length > 0 && (
            <div className="mt-4">
              <button
                onClick={() => setShowArchived((v) => !v)}
                className="text-sm font-medium text-zinc-600 hover:underline"
              >
                {showArchived ? "Hide" : "Show"} archived ({archived.length})
              </button>
              {showArchived && (
                <div className={`${listClassName} mt-3`}>{groupUnits(archived).map(renderUnit)}</div>
              )}
            </div>
          )}
        </>
      )}
    </main>
  );
}
