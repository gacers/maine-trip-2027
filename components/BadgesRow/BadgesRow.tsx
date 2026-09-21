import Badge, { assignBadgeVariants, type BadgeVariant, type BadgeProps } from "./Badge";
import { statusBadgeVariant } from "@/lib/statusFields";
import type { ReactNode } from "react";
import styles from "./BadgesRow.module.css";

export interface BadgeItem {
  key: string;
  label: string;
  variant?: BadgeVariant;
}

export interface BadgesRowProps {
  items: BadgeItem[];
}

type BadgesRowComponent = ((props: BadgesRowProps) => ReactNode) & {
  Badge: typeof Badge;
  assignBadgeVariants: typeof assignBadgeVariants;
};

// Shared eyebrow pills — same Badge look as Food & Drink EntryCards
// (Closed, Moved, Restaurant, …). Parent builds the list; use BadgesRow.Badge
// (or the Badge export) for a single pill outside the row.
const BadgesRow: BadgesRowComponent = Object.assign(
  function BadgesRow({ items }: BadgesRowProps) {
    if (items.length === 0) return null;
    return (
      <div className={styles["root"]}>
        <div className={styles["eyebrows"]}>
          {items.map((item) => (
            <Badge
              key={item.key}
              variant={item.variant ?? statusBadgeVariant(item.key) ?? "neutral"}
            >
              {item.label}
            </Badge>
          ))}
        </div>
      </div>
    );
  },
  { Badge, assignBadgeVariants }
);

export default BadgesRow;
export { Badge, assignBadgeVariants };
export type { BadgeVariant, BadgeProps };
