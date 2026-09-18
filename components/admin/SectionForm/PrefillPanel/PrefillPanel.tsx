"use client";

import { useEffect, useState } from "react";
import Button from "@/components/Button";
import type { CandidateSection } from "@/lib/entries";
import type { ImportSourceInfo } from "@/lib/entrySync";
import CandidateRow from "./CandidateRow";
import styles from "./PrefillPanel.module.css";

export interface PrefillPanelProps {
  tripSlug: string;
  navGroupSlug: string;
  sectionSlug: string;
  sectionId: string;
}

// Lets an admin pull entries in from one or more real, specific
// sections (this same trip's own, or any other trip's) — shown only
// on a past/"previously visited" tier's own edit page (see
// SectionForm's looksLikePastTier), and only once there's actually
// something real to choose from. Every candidate is named explicitly
// ("<trip> — <section> (N entries)") rather than a blind blended
// count, so it's always clear exactly what picking it would do.
//
// Two independent ways to bring a source in, both on CandidateRow:
//  - "Sync all (ongoing)" — the whole section, kept live going
//    forward (see lib/entrySync.ts): field_defs lock to mirror every
//    linked source's, every entry stays linked to its own source row,
//    and anything the source adds later auto-arrives too.
//  - "Pick specific spots" — an expandable checklist of that source's
//    own entries (confirmed live as its own real need: hand-picking
//    which of an earlier trip's spots are actually relevant to this
//    one, not "bring the whole list over"). Each picked entry still
//    stays live-synced individually, but nothing the source adds
//    later arrives on its own — reopen the same checklist any time
//    to pick up ones added since; already-picked entries show as
//    already added instead of duplicating (matching remembering a
//    forgotten one later).
export default function PrefillPanel({ tripSlug, navGroupSlug, sectionSlug, sectionId }: PrefillPanelProps) {
  const [candidates, setCandidates] = useState<CandidateSection[] | null>(null);
  const [sources, setSources] = useState<ImportSourceInfo[] | null>(null);
  const [applying, setApplying] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  function loadSources() {
    fetch(`/api/trips/${tripSlug}/entries/import?sectionId=${sectionId}`)
      .then((res) => res.json())
      .then((data) => setSources(data.sources || []))
      .catch(() => setSources([]));
  }

  function loadCandidates() {
    const params = new URLSearchParams({ navGroupSlug, slug: sectionSlug, excludeSectionId: sectionId });
    fetch(`/api/trips/${tripSlug}/import-candidates?${params}`)
      .then((res) => res.json())
      .then((data) => setCandidates(data.candidates || []))
      .catch(() => setCandidates([]));
  }

  useEffect(() => {
    loadCandidates();
    loadSources();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripSlug, navGroupSlug, sectionSlug, sectionId]);

  // Adding this section's very first ongoing source is the only time
  // this needs to ask anything — warns (and clears, on confirmation)
  // whenever there's already plain, never-synced content sitting here
  // predating going into sync mode at all; a 2nd+ source never asks.
  // A "pick specific spots" add never asks either — it never touches
  // anything already here.
  async function syncAll(candidate: CandidateSection) {
    setError("");
    setMessage("");
    setApplying(candidate.sectionId);
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
        body: JSON.stringify({ sectionId, sourceSectionId: candidate.sectionId, action: "add", clearUnsynced }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Sync failed");
      const skippedNote = data.skipped > 0 ? ` (${data.skipped} already here from another source, skipped)` : "";
      setMessage(
        `Synced in ${data.imported} ${data.imported === 1 ? "entry" : "entries"}${skippedNote} — this section now updates automatically when the source does.`
      );
      loadSources();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setApplying(null);
    }
  }

  async function addSelected(candidate: CandidateSection, entryIds: string[]) {
    setError("");
    setMessage("");
    setApplying(candidate.sectionId);
    try {
      const res = await fetch(`/api/trips/${tripSlug}/entries/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sectionId, sourceSectionId: candidate.sectionId, action: "add-selected", entryIds }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Add failed");
      const skippedNote = data.skipped > 0 ? ` (${data.skipped} already here, skipped)` : "";
      setMessage(`Added ${data.imported} ${data.imported === 1 ? "spot" : "spots"}${skippedNote} from ${candidate.tripName} — ${candidate.sectionLabel}.`);
    } catch (err) {
      setError((err as Error).message);
      throw err;
    } finally {
      setApplying(null);
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
        Link entries in from one or more already-documented lists — this trip&apos;s own, or another trip&apos;s.
        Sync a whole list to keep it live going forward, or pick just the spots that are actually relevant here.
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
        <ul className={styles["candidate-list"]}>
          {addableCandidates.map((candidate) => (
            <CandidateRow
              key={candidate.sectionId}
              candidate={candidate}
              tripSlug={tripSlug}
              destSectionId={sectionId}
              busy={applying === candidate.sectionId}
              onSyncAll={() => syncAll(candidate)}
              onAddSelected={(entryIds) => addSelected(candidate, entryIds)}
            />
          ))}
        </ul>
      )}
      {message && <p className={styles["message"]}>{message}</p>}
      {error && <p className={styles["error"]}>{error}</p>}
    </div>
  );
}
