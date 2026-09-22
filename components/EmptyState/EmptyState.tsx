import type { ReactNode } from "react";
import styles from "./EmptyState.module.css";

export interface EmptyStateProps {
  children: ReactNode;
  className?: string;
}

/** Centered empty-page message (horizontally + vertically). */
export default function EmptyState({ children, className }: EmptyStateProps) {
  return (
    <p className={className ? `${styles.root} ${className}` : styles.root}>
      {children}
    </p>
  );
}

/** Drop " — paste a link above." style suffixes from stored section copy. */
export function shortEmptyMessage(message: string | null | undefined, fallback = "Nothing here yet"): string {
  if (!message?.trim()) return fallback;
  const cut = message.split(/\s+[—–-]\s+(?:paste|add)\b/i)[0]?.trim();
  return cut || message.trim();
}
