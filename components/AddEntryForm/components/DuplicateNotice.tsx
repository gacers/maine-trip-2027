import type { ClientEntry } from "@/lib/types";
import styles from "./DuplicateNotice.module.css";

export interface DuplicateNoticeProps {
  duplicate: ClientEntry;
  onRequestPairExisting?: (entry: ClientEntry) => void;
  onReset: () => void;
}

// The URL just fetched already matches an entry on the list — either
// walk away (Add a different one) or, on a pairing section, use this
// same existing entry as the first half of a new pair instead of
// creating a duplicate row for the same place.
export default function DuplicateNotice({ duplicate, onRequestPairExisting, onReset }: DuplicateNoticeProps) {
  return (
    <div className={styles["root"]}>
      Already on the list:{" "}
      <a href={`#listing-${duplicate.id}`} className={styles["link"]}>
        {duplicate.title}
      </a>
      .
      <div className={styles["actions"]}>
        {onRequestPairExisting && (
          <button onClick={() => onRequestPairExisting(duplicate)} className={styles["pair-button"]}>
            Pair it with a new second property
          </button>
        )}
        <button onClick={onReset} className={styles["reset-button"]}>
          Add a different one
        </button>
      </div>
    </div>
  );
}
