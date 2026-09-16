import type { Section } from "@/lib/types";
import styles from "./SectionOptionsFields.module.css";

export interface SectionOptionsFieldsProps {
  supportsPairing: boolean;
  onSupportsPairingChange: (v: boolean) => void;
  hasMap: boolean;
  onHasMapChange: (v: boolean) => void;
  supportsRatings: boolean;
  onSupportsRatingsChange: (v: boolean) => void;
  cardLayout: Section["card_layout"];
  onCardLayoutChange: (v: Section["card_layout"]) => void;
}

// Pairing/map/ratings/card-layout — every behavioral toggle a section
// has. Grid items (not its own wrapper), since these sit alongside the
// parent's own Label/slug/etc. fields in the same grid.
export default function SectionOptionsFields({
  supportsPairing,
  onSupportsPairingChange,
  hasMap,
  onHasMapChange,
  supportsRatings,
  onSupportsRatingsChange,
  cardLayout,
  onCardLayoutChange,
}: SectionOptionsFieldsProps) {
  return (
    <>
      <label className={styles["checkbox-field"]}>
        <input
          type="checkbox"
          checked={supportsPairing}
          onChange={(e) => onSupportsPairingChange(e.target.checked)}
          className={styles["checkbox"]}
        />
        Supports pairing two items into one option
      </label>
      <label className={styles["checkbox-field"]}>
        <input type="checkbox" checked={hasMap} onChange={(e) => onHasMapChange(e.target.checked)} className={styles["checkbox"]} />
        Show a map with driving times, not just a plain marker. Off for an already-decided list.
      </label>
      <label className={styles["checkbox-field"]}>
        <input
          type="checkbox"
          checked={supportsRatings}
          onChange={(e) => onSupportsRatingsChange(e.target.checked)}
          className={styles["checkbox"]}
        />
        Show 5-star ratings — each visitor&apos;s score, plus the average.
      </label>
      <label className={styles["field"]}>
        Card layout
        <select value={cardLayout} onChange={(e) => onCardLayoutChange(e.target.value as Section["card_layout"])} className={styles["input"]}>
          <option value="list">One full-width card per row — best for houses/stays</option>
          <option value="grid-2">Small card, two per row</option>
          <option value="grid-3">Compact card, three per row — best for lighter entries</option>
        </select>
      </label>
    </>
  );
}
