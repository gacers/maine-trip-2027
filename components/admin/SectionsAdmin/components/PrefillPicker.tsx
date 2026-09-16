import type { CandidateSection } from "@/lib/entries";
import styles from "./PrefillPicker.module.css";

export interface PrefillPickerProps {
  candidates: CandidateSection[];
  value: string;
  onChange: (sourceSectionId: string) => void;
  disabled?: boolean;
}

// One real, specific trip+section to prefill from — replaces an
// earlier version that just blended every same-slug match across every
// other trip into one opaque count, with no way to tell whose list was
// actually contributing what (confirmed live as genuinely confusing:
// "Food & Drink" alone matched well over a hundred entries blended in
// from every unrelated trip that happens to share that section slug).
// Nothing renders at all with no real candidates to choose from.
export default function PrefillPicker({ candidates, value, onChange, disabled }: PrefillPickerProps) {
  if (candidates.length === 0) return null;
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className={styles["select"]}
    >
      <option value="">— Don&apos;t prefill —</option>
      {candidates.map((c) => (
        <option key={c.sectionId} value={c.sectionId}>
          {c.tripName} — {c.sectionLabel} ({c.entryCount} {c.entryCount === 1 ? "entry" : "entries"})
          {c.tripCompleted ? "" : " · in progress"}
        </option>
      ))}
    </select>
  );
}
