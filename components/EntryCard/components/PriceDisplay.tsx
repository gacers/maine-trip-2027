import { computeBadge as computePriceBadge, formatPriceDisplay } from "@/lib/fieldTypes/price";
import type { ClientEntry, FieldDef } from "@/lib/types";
import styles from "./PriceDisplay.module.css";

export interface PriceDisplayProps {
  entry: ClientEntry;
  priceFields: FieldDef[];
}

// The card's own price column, top-right of the title — self-gates on
// there being any price-type field defined at all, so the parent can
// just always render this rather than wrapping it in its own check.
export default function PriceDisplay({ entry, priceFields }: PriceDisplayProps) {
  if (priceFields.length === 0) return null;
  return (
    <div className={styles["root"]}>
      {priceFields.map((f) => {
        const value = entry[f.key] as string;
        if (!value) {
          return (
            <div key={f.key} className={styles["no-price"]}>
              No {f.label.toLowerCase()} yet
            </div>
          );
        }
        // A badge only ever appears when the value already states its
        // own breakdown ("/night" or "for N nights") — a bare number
        // ("$3,500", or a plain "3500") is shown as-is (formatted as
        // real currency either way) with no computed avg/night guessed
        // under it. That guess used to run off whatever the trip's
        // length happened to be, which actively produced a wrong
        // reading the moment it guessed wrong (confirmed live: a real
        // $273/night price, with the trip's real length known, got
        // divided down to "~$30/night"). FieldInput's own per-night/
        // total-for-stay toggle is what resolves a bare number now, at
        // the moment it's entered, not here.
        const badge = computePriceBadge(value);
        return (
          <div key={f.key} className={styles["group"]}>
            {/* The total is what actually matters when comparing
                options — the per-night average is useful context, not
                the headline number. */}
            <span className={styles["total"]}>{formatPriceDisplay(value)}</span>
            {badge && <span className={styles["avg"]}>{badge}</span>}
          </div>
        );
      })}
    </div>
  );
}
