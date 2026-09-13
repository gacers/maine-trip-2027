"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

function slugify(s) {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export default function NewTripForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  function handleNameChange(v) {
    setName(v);
    if (!slugTouched) setSlug(slugify(v));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const res = await fetch("/api/trips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, slug, startDate: startDate || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong");
      router.push(`/${data.trip.slug}/admin/sections`);
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm">
        Name
        <input
          required
          value={name}
          onChange={(e) => handleNameChange(e.target.value)}
          placeholder="Iceland 2028"
          className="rounded border border-zinc-300 px-2 py-1.5"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        URL slug
        <input
          required
          value={slug}
          onChange={(e) => {
            setSlugTouched(true);
            setSlug(e.target.value);
          }}
          className="rounded border border-zinc-300 px-2 py-1.5"
        />
        <span className="text-xs text-zinc-500">yoursite.com/{slug || "..."}</span>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Start date (optional — used to sort the trips list)
        <input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className="rounded border border-zinc-300 px-2 py-1.5"
        />
      </label>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={saving}
        className="rounded bg-zinc-900 text-white px-4 py-2 text-sm font-medium disabled:opacity-50"
      >
        {saving ? "Creating..." : "Create trip"}
      </button>
      <p className="text-xs text-zinc-500 text-center">
        You&apos;ll add its sections (Houses, Food &amp; Drink, whatever you want) next.
      </p>
    </form>
  );
}
