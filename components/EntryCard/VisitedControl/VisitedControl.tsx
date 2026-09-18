import Button from "@/components/Button";
import type { ClientEntry } from "@/lib/types";
import styles from "./VisitedControl.module.css";

export interface VisitedControlProps {
  entry: ClientEntry;
  supportsPairing: boolean;
  onPatch: (id: string, patch: Record<string, unknown>) => void;
}

// "Stayed here" for a pairing (Stay Options) section, "Visited"
// everywhere else, same visited/visitedDate fields either way. Not
// gated on the trip being marked Completed — checking this off can
// happen any time, during the trip or after; Completed only gates the
// separate "Archive unvisited" sweep (see ArchiveUnvisitedButton) that
// treats whatever's still unchecked at that point as never having
// happened. The date is opt-in (a "+ Add date" link, not a date box
// shown by default) — it only really matters once there's more than
// one visited item in a section to put in order; a single one doesn't
// need it. Just the inner row — the parent owns the section wrapper
// and the check for whether to show this at all.
export default function VisitedControl({ entry, supportsPairing, onPatch }: VisitedControlProps) {
  const label = supportsPairing ? "stayed here" : "visited";

  if (!entry.visited) {
    // Still wrapped in .root (a flex row, not full width) even though
    // there's only one child — a bare Button here would otherwise be a
    // direct child of the parent's flex-column .section, which
    // stretches it to the full row width and centers its label instead
    // of leaving it left-aligned and sized to its own text.
    return (
      <div className={styles["root"]}>
        <Button variant="ghost" size="sm" onClick={() => onPatch(entry.id, { visited: true })}>
          Mark {label}
        </Button>
      </div>
    );
  }

  return (
    <div className={styles["root"]}>
      <span className={styles["check"]}>✓ {supportsPairing ? "Stayed here" : "Visited"}</span>
      {entry.visitedDate ? (
        <input
          type="date"
          value={entry.visitedDate as string}
          onChange={(e) => onPatch(entry.id, { visitedDate: e.target.value || null })}
          className={styles["date-input"]}
        />
      ) : (
        <Button variant="ghost" size="sm" onClick={() => onPatch(entry.id, { visitedDate: new Date().toISOString().slice(0, 10) })}>
          + Add date
        </Button>
      )}
      <Button variant="ghost" size="sm" onClick={() => onPatch(entry.id, { visited: false, visitedDate: null })}>
        Undo
      </Button>
    </div>
  );
}
