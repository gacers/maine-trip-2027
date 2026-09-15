import type { ReactNode } from "react";
import classNames from "classnames";
import styles from "./BulletList.module.css";

export interface BulletListProps {
  children: ReactNode;
  /** Set false for a plain, unbulleted <ul> — no disc markers, no left
   * indent — while still sharing this component's reset instead of
   * whatever the browser's un-reset default padding happens to be.
   * Used for a horizontal icon row (EntryCard's Bedrooms/Beds/
   * Bathrooms strip) or anywhere else a <ul> is just semantics, not an
   * actual bulleted list. Defaults to true so every existing call site
   * keeps its bullets. */
  bulleted?: boolean;
  className?: string;
}

// The one bulleted-list look every plain text list in the app shares
// (Description, Notes, Concerns, a map's Driving Times, ...) — disc
// bullets, consistent indent/spacing/color, instead of each place that
// happens to render a <ul> ending up with its own ad hoc (or entirely
// un-reset browser default) spacing. Callers provide their own <li>
// children — a plain string, a link, a "loading" placeholder, whatever
// that particular list's items need to be.
export default function BulletList({ children, bulleted = true, className }: BulletListProps) {
  const classes = classNames(styles["root"], !bulleted && styles["plain"], className);
  return <ul className={classes}>{children}</ul>;
}
