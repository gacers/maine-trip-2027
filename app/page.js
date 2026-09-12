"use client";

import { useEffect, useState } from "react";
import AddListingForm from "@/components/AddListingForm";
import ListingCard from "@/components/ListingCard";

export default function Home() {
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showArchived, setShowArchived] = useState(false);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/listings", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load listings");
      setListings(data.listings);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function applyLocalPatch(id, patch) {
    setListings((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  }

  async function handlePatch(id, patch) {
    applyLocalPatch(id, patch); // optimistic
    try {
      const res = await fetch(`/api/listings/${id}`, {
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
      const res = await fetch(`/api/listings/${id}`, { method: "DELETE" });
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

  return (
    <div className="flex-1 w-full">
      <header className="max-w-4xl mx-auto px-4 pt-8 pb-4 text-center">
        <h1 className="text-2xl sm:text-3xl font-bold text-zinc-900">
          Maine Coast Trip &mdash; July 2027
        </h1>
        <p className="text-zinc-600 mt-1">House options for the group. 8 people, ~4 dogs.</p>
      </header>

      <main className="max-w-4xl mx-auto px-4 pb-16 flex flex-col gap-6">
        <AddListingForm onAdded={handleAdded} />

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-2">
            {error}
          </p>
        )}

        {loading ? (
          <p className="text-zinc-500 text-sm">Loading...</p>
        ) : (
          <>
            <div className="flex flex-col gap-4">
              {active.length === 0 && (
                <p className="text-zinc-500 text-sm">No listings yet &mdash; paste a URL above.</p>
              )}
              {active.map((listing) => (
                <ListingCard
                  key={listing.id}
                  listing={listing}
                  onPatch={handlePatch}
                  onDelete={handleDelete}
                />
              ))}
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
                    {archived.map((listing) => (
                      <ListingCard
                        key={listing.id}
                        listing={listing}
                        onPatch={handlePatch}
                        onDelete={handleDelete}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </main>

      <footer className="text-center text-xs text-zinc-400 pb-8">
        Also tracked in the shared Google Sheet.
      </footer>
    </div>
  );
}
