import { overviewFieldIcon } from "../helpers";
import type { FieldDef } from "@/lib/types";
import styles from "./OverviewFieldsRow.module.css";

export interface OverviewFieldRow {
  fieldDef: FieldDef;
  value: unknown;
}

export interface OverviewFieldsRowProps {
  rows: OverviewFieldRow[];
}

// Any custom field marked "show on overview" that isn't already handled
// by its own dedicated display (price/count/boolean — see EntryCard's
// priceFields/countRows/activeBooleanFields) previously had nowhere to
// render at all, regardless of that setting — a phone number or a
// website just silently didn't show up on the card. This is that
// fallback: a plain icon-led row per field (icon is a best-effort
// label/key match, see overviewFieldIcon — no icon rather than a wrong
// one when nothing matches), a url-type field's value rendered as an
// actual link instead of plain text.
export default function OverviewFieldsRow({ rows }: OverviewFieldsRowProps) {
  return (
    <ul className={styles["list"]}>
      {rows.map(({ fieldDef, value }) => (
        <li key={fieldDef.key} className={styles["item"]}>
          {overviewFieldIcon(fieldDef)}
          {fieldDef.field_type === "url" ? (
            <a href={value as string} target="_blank" rel="noopener noreferrer" className={styles["link"]}>
              {fieldDef.label}
            </a>
          ) : (
            <span>
              <span className={styles["label"]}>{fieldDef.label}:</span> {value as string}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}
