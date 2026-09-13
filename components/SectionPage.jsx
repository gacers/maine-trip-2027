"use client";

import { useEffect, useState } from "react";
import AddEntryForm from "@/components/AddEntryForm";
import EntryCard from "@/components/EntryCard";
import ListingSection from "@/components/ListingSection";
import GroupMap from "@/components/GroupMap";
import OverviewMap from "@/components/OverviewMap";
import { groupUnits } from "@/lib/groupUnits";

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
export default function SectionPage({ trip, section }) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showArchived, setShowArchived] = useState(false);

  const apiBase = `/api/trips/${trip.slug}/sections/${section.slug}/entries`;
  const fieldDefs = section.field_defs || [];
  const mapConfig = trip.map_config;

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
        headers: { "Content-Type": "application/json" },
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
      const res = await fetch(`${apiBase}/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
    } catch (err) {
      setError(err.message);
      load();
    }
  }

  function handleAdded(entry) {
    setEntries((prev) => [...prev, entry]);
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
          rank={unit.listings[0].rank ?? undefined}
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
                  bare
                  showRank={false}
                  showMap={false}
                />
              </div>
            ))}
          </div>
          <GroupMap listings={unit.listings} mapConfig={mapConfig} />
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
          bare
          showTitle={false}
        />
      </ListingSection>
    );
  }

  return (
    <main className="max-w-4xl mx-auto px-4 pb-16 flex flex-col gap-6 w-full">
      <div className="flex justify-center">
        {trip.google_sheet_url && (
          <a
            href={trip.google_sheet_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-full border border-zinc-300 bg-white px-4 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
          >
            Google Sheet
          </a>
        )}
      </div>

      <AddEntryForm trip={trip} section={section} onAdded={handleAdded} />

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-2">{error}</p>
      )}

      {loading ? (
        <p className="text-zinc-500 text-sm">Loading...</p>
      ) : (
        <>
          {!loading && active.length > 0 && <OverviewMap pins={pins} />}

          <div className="flex flex-col gap-4">
            {active.length === 0 && (
              <p className="text-zinc-500 text-sm">{section.empty_message}</p>
            )}
            {activeUnits.map(renderUnit)}
          </div>

          {archived.length > 0 && (
            <div className="mt-4">
              <button
                onClick={() => setShowArchived((v) => !v)}
                className="text-sm font-medium text-zinc-600 hover:underline"
              >
                {showArchived ? "Hide" : "Show"} archived ({archived.length})
              </button>
              {showArchived && (
                <div className="flex flex-col gap-4 mt-3">
                  {groupUnits(archived).map(renderUnit)}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </main>
  );
}
