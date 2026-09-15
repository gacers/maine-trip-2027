"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import styles from "./NewTripForm.module.css";

function slugify(s: string): string {
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
  const [endDate, setEndDate] = useState("");
  const [nightsEstimate, setNightsEstimate] = useState("");
  const [pastTrip, setPastTrip] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  function handleNameChange(v: string) {
    setName(v);
    if (!slugTouched) setSlug(slugify(v));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const res = await fetch("/api/trips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          slug,
          startDate: startDate || undefined,
          endDate: endDate || undefined,
          nightsEstimate: nightsEstimate ? Number(nightsEstimate) : undefined,
          completed: pastTrip,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong");
      router.push(`/${data.trip.slug}/admin/sections`);
    } catch (err) {
      setError((err as Error).message);
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className={styles["root"]}>
      <label className={styles["field"]}>
        Name
        <input
          required
          value={name}
          onChange={(e) => handleNameChange(e.target.value)}
          placeholder="Iceland 2028"
          className={styles["input"]}
        />
      </label>
      <label className={styles["field"]}>
        URL slug
        <input
          required
          value={slug}
          onChange={(e) => {
            setSlugTouched(true);
            setSlug(e.target.value);
          }}
          className={styles["input"]}
        />
        <span className={styles["hint"]}>yoursite.com/{slug || "..."}</span>
      </label>
      <div className={styles["date-row"]}>
        <label className={styles["field"]}>
          Start date (optional — used to sort the trips list)
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className={styles["input"]}
          />
        </label>
        <label className={styles["field"]}>
          End date (optional)
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className={styles["input"]}
          />
        </label>
      </div>
      <label className={styles["field"]}>
        Estimated length in nights (optional — used to estimate a price/night if exact dates aren&apos;t known yet)
        <input
          type="number"
          min="1"
          value={nightsEstimate}
          onChange={(e) => setNightsEstimate(e.target.value)}
          placeholder="e.g. 7"
          className={styles["input"]}
        />
      </label>
      <label className={styles["checkbox-field"]}>
        <input
          type="checkbox"
          checked={pastTrip}
          onChange={(e) => setPastTrip(e.target.checked)}
          className={styles["checkbox"]}
        />
        This documents a trip that already happened — mark it Completed now, so anything you add to a plain list
        (not a still-deciding &quot;Options&quot; section) comes in already checked off as Stayed/Visited instead of
        needing that clicked one by one.
      </label>
      {error && <p className={styles["error"]}>{error}</p>}
      <button type="submit" disabled={saving} className={styles["submit-button"]}>
        {saving ? "Creating..." : "Create trip"}
      </button>
      <p className={styles["hint-centered"]}>
        You&apos;ll add its sections (Houses, Food &amp; Drink, whatever you want) next.
      </p>
    </form>
  );
}
