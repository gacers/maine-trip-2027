import type { ReactNode } from "react";
import BulletList from "@/components/BulletList";
import { countFieldIcon, singularizeCountLabel } from "../helpers";
import type { FieldDef } from "@/lib/types";
import styles from "./CountsRow.module.css";

export interface CountRow {
  fieldDef: FieldDef;
  value: unknown;
}

export interface CountsRowProps {
  countRows: CountRow[];
}

// Bedrooms/Beds/Bathrooms etc. as their own horizontal, icon-led strip
// — rather than crammed into the price column or flattened into one
// "3 Bedrooms / 6 Beds / 2 Bathrooms" sentence. Just the inner list —
// the parent owns the surrounding section wrapper (and the check for
// whether to render one at all).
export default function CountsRow({ countRows }: CountsRowProps) {
  return (
    <BulletList bulleted={false} className={styles["list"]}>
      {countRows.map(({ fieldDef, value }) => (
        <li key={fieldDef.key} className={styles["item"]}>
          {countFieldIcon(fieldDef.label)}
          <span>
            {value as ReactNode} {singularizeCountLabel(fieldDef.options?.shortLabel || fieldDef.label, value)}
          </span>
        </li>
      ))}
    </BulletList>
  );
}
