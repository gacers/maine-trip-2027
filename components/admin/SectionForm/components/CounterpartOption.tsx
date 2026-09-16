import { VISITED_PREFIX } from "@/lib/sectionLabels";
import styles from "./CounterpartOption.module.css";

export interface CounterpartOptionProps {
  addCounterpart: boolean;
  onAddCounterpartChange: (v: boolean) => void;
  counterpartLabel: string;
  onCounterpartLabelChange: (v: string) => void;
  /** The primary section's own label, for the placeholder suggestion
   * ("Visited {label}") — just cosmetic, the real default
   * is computed at submit time in the parent. */
  primaryLabel: string;
}

// "Also create a Visited counterpart" — offered only at
// creation time (the parent gates this on !isEdit), same pattern as
// Stay Options/Stayed Before: a second section in the same nav group,
// sharing the same fields, for things already done.
export default function CounterpartOption({
  addCounterpart,
  onAddCounterpartChange,
  counterpartLabel,
  onCounterpartLabelChange,
  primaryLabel,
}: CounterpartOptionProps) {
  return (
    <div className={styles["root"]}>
      <label className={styles["label"]}>
        <input
          type="checkbox"
          checked={addCounterpart}
          onChange={(e) => onAddCounterpartChange(e.target.checked)}
          className={styles["checkbox"]}
        />
        Also create a &quot;Visited&quot; counterpart
      </label>
      <p className={styles["hint"]}>
        Same pattern as Stay Options / Stayed Before — a second section in the same nav group, sharing the same
        fields, for things you&apos;ve already done (e.g. Distilleries you want to visit vs. ones you&apos;ve already
        been to).
      </p>
      {addCounterpart && (
        <label className={styles["field"]}>
          Counterpart label
          <input
            value={counterpartLabel}
            onChange={(e) => onCounterpartLabelChange(e.target.value)}
            placeholder={`${VISITED_PREFIX} ${primaryLabel || "..."}`}
            className={styles["input"]}
          />
        </label>
      )}
    </div>
  );
}
