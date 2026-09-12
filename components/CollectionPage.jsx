"use client";

import { useEffect, useState } from "react";
import AddListingForm from "@/components/AddListingForm";
import ListingCard from "@/components/ListingCard";
import ListingSection from "@/components/ListingSection";
import GroupMap from "@/components/GroupMap";
import OverviewMap from "@/components/OverviewMap";

// Groups a rank-sorted list of items into render units: a "group" unit
// for two items sharing the same non-empty groupLabel (a 2-house
// option, or any other paired option), otherwise a "solo" unit per item.
// Order follows the first item encountered in each pair.
function groupListings(sortedListings) {
  const seen = new Set();
  const units = [];
  for (const l of sortedListings) {
    if (seen.has(l.id)) continue;
    if (l.groupLabel) {
      const partner = sortedListings.find(
        (o) => o.id !== l.id && o.groupLabel === l.groupLabel && !seen.has(o.id)
      );
      if (partner) {
        seen.add(l.id);
        seen.add(partner.id);
        units.push({ type: "group", label: l.groupLabel, listings: [l, partner] });
        continue;
      }
    }
    seen.add(l.id);
    units.push({ type: "solo", listing: l });
  }
  return units;
}

function pinFor(unit) {
  if (unit.type === "group") {
    const primary = unit.listings[0];
    return {
      anchor: `group-${primary.id}`,
      label: unit.label,
      lat: primary.lat,
      lng: primary.lng,
    };
  }
  return {
    anchor: `listing-${unit.listing.id}`,
    label: unit.listing.title,
    lat: unit.listing.lat,
    lng: unit.listing.lng,
  };
}

export default function CollectionPage({ collection }) {
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [sheetUrl, setSheetUrl] = useState("");

  const apiBase = `/api/${collection.apiSlug}`;

  async function load() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(apiBase, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load listings");
      setListings(data.listings);
      if (data.sheetUrl) setSheetUrl(data.sheetUrl);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collection.apiSlug]);

  function applyLocalPatch(id, patch) {
    setListings((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
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
      applyLocalPatch(id, data.listing);
    } catch (err) {
      setError(err.message);
      load(); // re-sync on failure
    }
  }

  async function handleDelete(id) {
    setListings((prev) => prev.filter((l) => l.id !== id));
    try {
      const res = await fetch(`${apiBase}/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
    } catch (err) {
      setError(err.message);
      load();
    }
  }

  function handleAdded(listing) {
    setListings((prev) => [...prev, listing]);
  }

  const active = listings
    .filter((l) => l.status !== "archived")
    .sort((a, b) => (a.rank ?? 999999) - (b.rank ?? 999999));
  const archived = listings.filter((l) => l.status === "archived");

  const activeUnits = groupListings(active);
  const pins = activeUnits.map(pinFor);

  function renderUnit(unit) {
    if (unit.type === "group") {
      return (
        <ListingSection
          key={unit.listings.map((l) => l.id).join("-")}
          id={`group-${unit.listings[0].id}`}
          title={unit.label}
          rank={unit.listings[0].rank ?? undefined}
          onRankChange={(newRank) =>
            unit.listings.forEach((l) => handlePatch(l.id, { rank: newRank }))
          }
        >
          <div className="flex flex-col sm:flex-row gap-4 sm:gap-5">
            {unit.listings.map((listing) => (
              <div key={listing.id} className="sm:w-1/2 min-w-0">
                <ListingCard
                  listing={listing}
                  onPatch={handlePatch}
                  onDelete={handleDelete}
                  bare
                  showRank={false}
                  showMap={false}
                  showBedBath={collection.showBedBath}
                />
              </div>
            ))}
          </div>
          <GroupMap listings={unit.listings} />
        </ListingSection>
      );
    }
    return (
      <ListingSection key={unit.listing.id} title={unit.listing.title} href={unit.listing.url}>
        <ListingCard
          listing={unit.listing}
          onPatch={handlePatch}
          onDelete={handleDelete}
          bare
          showTitle={false}
          showBedBath={collection.showBedBath}
        />
      </ListingSection>
    );
  }

  return (
    <main className="max-w-4xl mx-auto px-4 pb-16 flex flex-col gap-6 w-full">
      <div className="flex justify-center">
        {sheetUrl && (
          <a
            href={sheetUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-full border border-zinc-300 bg-white px-4 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
          >
            Google Sheet
          </a>
        )}
      </div>

      <AddListingForm collection={collection} onAdded={handleAdded} />

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
              <p className="text-zinc-500 text-sm">{collection.emptyMessage}</p>
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
                  {groupListings(archived).map(renderUnit)}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </main>
  );
}
