import Badge, { type BadgeVariant } from "@/components/Badge";
import type { FieldDef } from "@/lib/types";
import styles from "./EntryBadgesRow.module.css";

export interface EntryBadgesRowProps {
  activeBooleanFields: FieldDef[];
  badgeVariants: Record<string, BadgeVariant>;
  showRank: boolean;
  canManage: boolean;
  rankDraft: string | number;
  onRankDraftChange: (v: string) => void;
  onCommitRank: () => void;
}

// Eyebrow badges (any true boolean field — "Closed", "Bar", ...) on the
// left, the manual Rank input on the right — just the inner row, the
// parent owns the check for whether either half has anything to show
// at all.
export default function EntryBadgesRow({
  activeBooleanFields,
  badgeVariants,
  showRank,
  canManage,
  rankDraft,
  onRankDraftChange,
  onCommitRank,
}: EntryBadgesRowProps) {
  return (
    <div className={styles["root"]}>
      {activeBooleanFields.length > 0 && (
        <div className={styles["eyebrows"]}>
          {activeBooleanFields.map((f) => (
            <Badge key={f.key} variant={f.key === "closed" ? "closed" : badgeVariants[f.key]}>
              {f.label}
            </Badge>
          ))}
        </div>
      )}
      {showRank && canManage && (
        <div className={styles["rank"]}>
          <label className={styles["rank-label"]}>Rank</label>
          <input
            type="number"
            value={rankDraft}
            onChange={(e) => onRankDraftChange(e.target.value)}
            onBlur={onCommitRank}
            className={styles["rank-input"]}
          />
        </div>
      )}
    </div>
  );
}
