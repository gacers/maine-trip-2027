"use client";

import { useState } from "react";
import Button from "@/components/Button";
import type { CandidateSection } from "@/lib/entries";
import styles from "./CandidateRow.module.css";

interface SourceEntry {
  id: string;
  title: string | null;
  url: string | null;
  /** Same url already sits in the destination — from this same source
   * (a previous pick, or the whole-section sync), or from a different
   * one entirely. Shown checked-and-disabled rather than left off the
   * list, so reopening this checklist later to grab a forgotten spot
   * makes it obvious what's already in versus still worth picking. */
  alreadyImported: boolean;
}

export interface CandidateRowProps {
  candidate: CandidateSection;
  tripSlug: string;
  destSectionId: string;
  /** True while this specific candidate's own "Sync all" is running —
   * PrefillPanel tracks one busy id at a time across every row. */
  busy: boolean;
  onSyncAll: () => void;
  /** Rejects on failure — PrefillPanel's own catch already surfaces
   * the error message, this just needs to know not to clear the
   * checklist's own selection afterward. */
  onAddSelected: (entryIds: string[]) => Promise<void>;
}

// One candidate section's own row — a plain "Sync all (ongoing)"
// button (see PrefillPanel's own comment) plus an expandable, freshly-
// reloaded-every-time checklist of that section's own entries for
// hand-picking just the relevant ones instead of the whole list.
export default function CandidateRow({ candidate, tripSlug, destSectionId, busy, onSyncAll, onAddSelected }: CandidateRowProps) {
  const [expanded, setExpanded] = useState(false);
  const [entries, setEntries] = useState<SourceEntry[] | null>(null);
  const [loadingEntries, setLoadingEntries] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);

  function loadEntries() {
    setLoadingEntries(true);
    const params = new URLSearchParams({ sourceSectionId: candidate.sectionId, destSectionId });
    fetch(`/api/trips/${tripSlug}/entries/import?${params}`)
      .then((res) => res.json())
      .then((data) => setEntries(data.entries || []))
      .catch(() => setEntries([]))
      .finally(() => setLoadingEntries(false));
  }

  function toggleExpanded() {
    const next = !expanded;
    setExpanded(next);
    // Reloaded on every open, not just the first — reopening later to
    // pick up a spot added to the source since, or one forgotten the
    // first time, needs a fresh alreadyImported view rather than a
    // stale snapshot.
    if (next) loadEntries();
  }

  function toggle(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  }

  async function submit() {
    if (selected.size === 0) return;
    setSubmitting(true);
    try {
      await onAddSelected([...selected]);
      setSelected(new Set());
      loadEntries();
    } catch {
      // Selection deliberately kept as-is on failure — PrefillPanel's
      // own catch already surfaced the error; nothing here to retry
      // differently.
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <li className={styles["root"]}>
      <div className={styles["row"]}>
        <span className={styles["label"]}>
          {candidate.tripName} — {candidate.sectionLabel} ({candidate.entryCount} {candidate.entryCount === 1 ? "entry" : "entries"})
          {candidate.tripCompleted ? "" : " · in progress"}
        </span>
        <div className={styles["actions"]}>
          <Button type="button" variant="ghost" size="sm" onClick={toggleExpanded}>
            {expanded ? "Hide spots" : "Pick specific spots"}
          </Button>
          <Button type="button" variant="secondary" size="sm" disabled={busy} onClick={onSyncAll}>
            {busy ? "Syncing..." : "Sync all (ongoing)"}
          </Button>
        </div>
      </div>

      {expanded && (
        <div className={styles["checklist"]}>
          {loadingEntries || !entries ? (
            <p className={styles["muted"]}>Loading...</p>
          ) : entries.length === 0 ? (
            <p className={styles["muted"]}>Nothing in this section yet.</p>
          ) : (
            <>
              <div className={styles["entries"]}>
                {entries.map((entry) => (
                  <label key={entry.id} className={styles["entry-label"]}>
                    <input
                      type="checkbox"
                      checked={entry.alreadyImported || selected.has(entry.id)}
                      disabled={entry.alreadyImported}
                      onChange={() => toggle(entry.id)}
                    />
                    {entry.title || entry.url || "(untitled)"}
                    {entry.alreadyImported && <span className={styles["already-tag"]}> — already added</span>}
                  </label>
                ))}
              </div>
              <Button type="button" variant="secondary" size="sm" disabled={selected.size === 0 || submitting} onClick={submit}>
                {submitting ? "Adding..." : `Add selected (${selected.size})`}
              </Button>
            </>
          )}
        </div>
      )}
    </li>
  );
}
