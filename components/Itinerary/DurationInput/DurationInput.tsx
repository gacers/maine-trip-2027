import styles from "./DurationInput.module.css";

export interface DurationInputProps {
  /** Total minutes, as a string — same contract as the rest of this
   * form's fields (StopScheduleValues.durationMinutes), so the parent
   * still just stores/sends one plain number regardless of how it's
   * edited. Empty string means "no duration set," not zero. */
  minutes: string;
  onChange: (minutes: string) => void;
}

// A raw "Duration (minutes)" field made 90 come out as "90" — fine to
// read once written, hard to actually type ("was that supposed to be
// an hour twenty, or two hours?"). Two small number inputs (hours,
// minutes) instead, combined into the same total-minutes string
// underneath — nothing downstream (the DB column, StopCard's own
// formatDuration display) needed to change, just how this one form
// edits it.
export default function DurationInput({ minutes, onChange }: DurationInputProps) {
  const total = minutes.trim() === "" ? null : parseInt(minutes, 10);
  const hasValue = total != null && !Number.isNaN(total);
  const hours = hasValue ? Math.floor(total! / 60) : null;
  const mins = hasValue ? total! % 60 : null;

  function setParts(newHours: number | null, newMins: number | null) {
    if (newHours == null && newMins == null) {
      onChange("");
      return;
    }
    onChange(String((newHours || 0) * 60 + (newMins || 0)));
  }

  return (
    <div className={styles["row"]}>
      <input
        type="number"
        min={0}
        placeholder="0"
        value={hours ?? ""}
        onChange={(e) => setParts(e.target.value === "" ? null : Number(e.target.value), mins)}
        className={styles["number"]}
        aria-label="Hours"
      />
      <span className={styles["unit"]}>h</span>
      <input
        type="number"
        min={0}
        max={59}
        placeholder="0"
        value={mins ?? ""}
        onChange={(e) => setParts(hours, e.target.value === "" ? null : Number(e.target.value))}
        className={styles["number"]}
        aria-label="Minutes"
      />
      <span className={styles["unit"]}>m</span>
    </div>
  );
}
