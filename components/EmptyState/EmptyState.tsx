import type { ReactNode } from "react";
import styles from "./EmptyState.module.css";

export interface EmptyStateProps {
  children?: ReactNode;
  className?: string;
  /** Same footprint as empty copy, no message — use while we don't know yet. */
  busy?: boolean;
}

/** Centered empty-page message (horizontally + vertically). */
export default function EmptyState({ children, className, busy = false }: EmptyStateProps) {
  const classes = className ? `${styles.root} ${className}` : styles.root;
  if (busy) {
    return <div className={classes} aria-busy="true" aria-label="Loading" />;
  }
  return <p className={classes}>{children}</p>;
}

/** Drop " — paste a link above." style suffixes from stored section copy. */
export function shortEmptyMessage(message: string | null | undefined, fallback = "Nothing here yet"): string {
  if (!message?.trim()) return fallback;
  const cut = message.split(/\s+[—–-]\s+(?:paste|add)\b/i)[0]?.trim();
  return cut || message.trim();
}
