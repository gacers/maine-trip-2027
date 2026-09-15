import Badge, { type BadgeVariant } from "@/components/Badge";
import type { FieldDef } from "@/lib/types";
import styles from "./EntryBadgesRow.module.css";

export interface EntryBadgesRowProps {
  activeBooleanFields: FieldDef[];
  badgeVariants: Record<string, BadgeVariant>;
}

// Eyebrow badges (any true boolean field — "Closed", "Bar", ...) — the
// parent owns the check for whether there's anything to show at all.
export default function EntryBadgesRow({ activeBooleanFields, badgeVariants }: EntryBadgesRowProps) {
  return (
    <div className={styles["root"]}>
      <div className={styles["eyebrows"]}>
        {activeBooleanFields.map((f) => (
          <Badge key={f.key} variant={f.key === "closed" ? "closed" : badgeVariants[f.key]}>
            {f.label}
          </Badge>
        ))}
      </div>
    </div>
  );
}
