import Badge, { type BadgeVariant } from "@/components/Badge";
import styles from "./BadgesRow.module.css";

export interface BadgeItem {
  key: string;
  label: string;
  variant?: BadgeVariant;
}

export interface BadgesRowProps {
  items: BadgeItem[];
}

// Shared eyebrow pills — same Badge look as Food & Drink EntryCards
// (Closed, Restaurant, Option, Visited, …). Parent builds the list.
export default function BadgesRow({ items }: BadgesRowProps) {
  if (items.length === 0) return null;
  return (
    <div className={styles["root"]}>
      <div className={styles["eyebrows"]}>
        {items.map((item) => (
          <Badge key={item.key} variant={item.variant ?? (item.key === "closed" ? "closed" : "neutral")}>
            {item.label}
          </Badge>
        ))}
      </div>
    </div>
  );
}
