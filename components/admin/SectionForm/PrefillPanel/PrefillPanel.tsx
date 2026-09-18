"use client";

import { useEffect, useState } from "react";
import Button from "@/components/Button";
import type { CandidateSection } from "@/lib/entries";
import type { ImportSourceInfo } from "@/lib/entrySync";
import styles from "./PrefillPanel.module.css";

export interface PrefillPanelProps {
  tripSlug: string;
  navGroupSlug: string;
  sectionSlug: string;
  sectionId: string;
}

// Lets an admin pick one or more real, specific sections (this same
// trip's own, or any other trip's) to sync entries in from — shown
// only on a past/"previously visited" tier's own edit page (see
// SectionForm's looksLikePastTier), and only once there's actually
// something real to choose from. Every candidate is named explicitly
// ("<trip> — <section> (N entries)") rather than a blind blended
// count, so it's always clear exactly what adding it would do.
//
// This is an ONGOING sync, not a one-time copy (see lib/entrySync.ts):
// this section's own field_defs lock to mirror every linked source's,
// and every entry that comes in stays linked to its own source row —
// an edit (or a brand-new entry) on any source shows up here
// automatically, with no re-import needed. Sources are added and
// removed independently — adding a 2nd, 3rd, 4th source never touches
// entries already synced in from the others (confirmed live as the
// whole point: one trip's "Past Distilleries" built up from 4 earlier
// trips' own Distilleries lists, none of them clobbering the rest).
export default function PrefillPanel({ tripSlug, navGroupSlug, sectionSlug, sectionId }: PrefillPanelProps) {
  const [candidates, setCandidates] = useState<CandidateSection[] | null>(null);
  const [sources, setSources] = useState<ImportSourceInfo[] | null>(null);
  const [selected, setSelected] = useState("");
  const [applying, setApplying] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  function loadSources() {
    fetch(`/api/trips/${tripSlug}/entries/import?sectionId=${sectionId}`)
      .then((res) => res.json())
      .then((data) => setSources(data.sources || []))
      .catch(() => setSources([]));
  }

  useEffect(() => {
    const params = new URLSearchParams({ navGroupSlug, slug: sectionSlug, excludeSectionId: sectionId });
    fetch(`/api/trips/${tripSlug}/import-candidates?${params}`)
      .then((res) => res.json())
      .then((data) => setCandidates(data.candidates || []))
      .catch(() => setCandidates([]));
    loadSources();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripSlug, navGroupSlug, sectionSlug, sectionId]);

  // Adding this section's very first source is the only time this
  // needs to ask anything — warns (and clears, on confirmation)
  // whenever there's already plain, never-synced content sitting here
  // predating going into sync mode at all; a 2nd+ source never asks,
  // since it only ever adds alongside whatever's already synced in
  // from the others.
  async function addSource() {
    if (!selected) return;
    setError("");
    setMessage("");
    setApplying(true);
    try {
      let clearUnsynced = false;
      if (!sources || sources.length === 0) {
        const entriesRes = await fetch(`/api/trips/${tripSlug}/sections/${navGroupSlug}/${sectionSlug}/entries`, {
          cache: "no-store",
        });
        const entriesData = await entriesRes.json();
        const unsyncedCount = (entriesData.entries || []).filter((e: { importSourceEntryId: string | null }) => !e.importSourceEntryId).length;
        if (unsyncedCount > 0) {
          const confirmed = window.confirm(
            `This section already has ${unsyncedCount} ${unsyncedCount === 1 ? "entry" : "entries"} not synced from anywhere. Remove ${unsyncedCount === 1 ? "it" : "them"} before syncing in from the source you picked — continue?`
          );
          if (!confirmed) return;
          clearUnsynced = true;
        }
      }

      const res = await fetch(`/api/trips/${tripSlug}/entries/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sectionId, sourceSectionId: selected, action: "add", clearUnsynced }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Sync failed");
      setMessage(`Synced in ${data.imported} ${data.imported === 1 ? "entry" : "entries"} — this section now updates automatically when the source does.`);
      setSelected("");
      loadSources();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setApplying(false);
    }
  }

  async function removeSource(source: ImportSourceInfo) {
    if (
      !window.confirm(
        `Stop syncing from ${source.tripName} — ${source.sectionLabel}? Every entry synced in from it will be removed — anything synced from your other sources stays.`
      )
    ) {
      return;
    }
    setError("");
    setMessage("");
    setRemovingId(source.sourceSectionId);
    try {
      const res = await fetch(`/api/trips/${tripSlug}/entries/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sectionId, sourceSectionId: source.sourceSectionId, action: "remove" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Remove failed");
      setMessage(`Removed ${data.removed} ${data.removed === 1 ? "entry" : "entries"} synced from ${source.tripName} — ${source.sectionLabel}.`);
      loadSources();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setRemovingId(null);
    }
  }

  if (!candidates || !sources) return null;
  const linkedIds = new Set(sources.map((s) => s.sourceSectionId));
  const addableCandidates = candidates.filter((c) => !linkedIds.has(c.sectionId));
  if (sources.length === 0 && addableCandidates.length === 0) return null;

  return (
    <div className={styles["root"]}>
      <div className={styles["label"]}>Sync from another section</div>
      <p className={styles["hint"]}>
        Link entries in from one or more already-documented lists — this trip&apos;s own, or another trip&apos;s —
        and keep them updated automatically when a source changes. Add as many as this section should draw from.
      </p>

      {sources.length > 0 && (
        <ul className={styles["source-list"]}>
          {sources.map((source) => (
            <li key={source.sourceSectionId} className={styles["source-row"]}>
              <span>
                {source.tripName} — {source.sectionLabel}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={removingId === source.sourceSectionId}
                onClick={() => removeSource(source)}
              >
                {removingId === source.sourceSectionId ? "Removing..." : "Remove"}
              </Button>
            </li>
          ))}
        </ul>
      )}

      {addableCandidates.length > 0 && (
        <div className={styles["row"]}>
          <select value={selected} onChange={(e) => setSelected(e.target.value)} className={styles["select"]}>
            <option value="">— Add a source —</option>
            {addableCandidates.map((c) => (
              <option key={c.sectionId} value={c.sectionId}>
                {c.tripName} — {c.sectionLabel} ({c.entryCount} {c.entryCount === 1 ? "entry" : "entries"})
                {c.tripCompleted ? "" : " · in progress"}
              </option>
            ))}
          </select>
          <Button type="button" variant="secondary" size="sm" disabled={!selected || applying} onClick={addSource}>
            {applying ? "Adding..." : "Add"}
          </Button>
        </div>
      )}
      {message && <p className={styles["message"]}>{message}</p>}
      {error && <p className={styles["error"]}>{error}</p>}
    </div>
  );
}
