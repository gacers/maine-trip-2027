"use client";

import { useEffect, useState } from "react";
import Button from "@/components/Button";
import type { CandidateSection } from "@/lib/entries";
import styles from "./PrefillPanel.module.css";

export interface PrefillPanelProps {
  tripSlug: string;
  navGroupSlug: string;
  sectionSlug: string;
  sectionId: string;
}

// Lets an admin pick one real, specific section (this same trip's own,
// or any other trip's) to copy entries in from — shown only on a past/
// "previously visited" tier's own edit page (see SectionForm's
// looksLikePastTier), and only once there's actually something real to
// choose from. Every candidate is named explicitly ("<trip> —
// <section> (N entries)") rather than a blind blended count, so it's
// always clear exactly what picking it would do; re-running it later
// against a source already applied, or clearing it back out, both go
// through the same Apply button and the same warn-before-overwriting
// dance (see applyPrefill's own comment).
export default function PrefillPanel({ tripSlug, navGroupSlug, sectionSlug, sectionId }: PrefillPanelProps) {
  const [candidates, setCandidates] = useState<CandidateSection[] | null>(null);
  const [selected, setSelected] = useState("");
  const [applying, setApplying] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const params = new URLSearchParams({ navGroupSlug, slug: sectionSlug, excludeSectionId: sectionId });
    fetch(`/api/trips/${tripSlug}/import-candidates?${params}`)
      .then((res) => res.json())
      .then((data) => setCandidates(data.candidates || []))
      .catch(() => setCandidates([]));
  }, [tripSlug, navGroupSlug, sectionSlug, sectionId]);

  // Warns and overwrites rather than just appending whenever this
  // section already has something in it — appending would leave
  // duplicates sitting next to whatever's already there, and silently
  // doing that (or silently clearing it out, picking "— Don't prefill
  // —" after it was already populated this way) without asking isn't
  // OK for something this destructive-if-wrong. A fresh, empty section
  // never asks — there's nothing to lose yet.
  async function apply() {
    setError("");
    setMessage("");
    setApplying(true);
    try {
      const entriesRes = await fetch(`/api/trips/${tripSlug}/sections/${navGroupSlug}/${sectionSlug}/entries`, {
        cache: "no-store",
      });
      const entriesData = await entriesRes.json();
      const existingCount = (entriesData.entries || []).length;
      if (!selected && existingCount === 0) return;
      if (existingCount > 0) {
        const confirmed = window.confirm(
          selected
            ? `This section already has ${existingCount} ${existingCount === 1 ? "entry" : "entries"}. Picking a new source will replace ${existingCount === 1 ? "it" : "them"} with fresh copies from there — continue?`
            : `Remove the ${existingCount} ${existingCount === 1 ? "entry" : "entries"} currently in this section?`
        );
        if (!confirmed) return;
      }

      const res = await fetch(`/api/trips/${tripSlug}/entries/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sectionId, sourceSectionId: selected || undefined, overwrite: existingCount > 0 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Copy failed");
      setMessage(selected ? `Copied in ${data.imported} ${data.imported === 1 ? "entry" : "entries"}.` : "Cleared.");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setApplying(false);
    }
  }

  if (!candidates || candidates.length === 0) return null;

  return (
    <div className={styles["root"]}>
      <div className={styles["label"]}>Prefill from another section</div>
      <p className={styles["hint"]}>
        Copy entries in from an already-documented list — this trip&apos;s own, or another trip&apos;s.
      </p>
      <div className={styles["row"]}>
        <select value={selected} onChange={(e) => setSelected(e.target.value)} className={styles["select"]}>
          <option value="">— Don&apos;t prefill —</option>
          {candidates.map((c) => (
            <option key={c.sectionId} value={c.sectionId}>
              {c.tripName} — {c.sectionLabel} ({c.entryCount} {c.entryCount === 1 ? "entry" : "entries"})
              {c.tripCompleted ? "" : " · in progress"}
            </option>
          ))}
        </select>
        <Button type="button" variant="secondary" size="sm" disabled={applying} onClick={apply}>
          {applying ? "Applying..." : "Apply"}
        </Button>
      </div>
      {message && <p className={styles["message"]}>{message}</p>}
      {error && <p className={styles["error"]}>{error}</p>}
    </div>
  );
}
