import type { ReactNode } from "react";
import styles from "./BulletList.module.css";

export interface BulletListProps {
  children: ReactNode;
}

// The one bulleted-list look every plain text list in the app shares
// (Description, Notes, Concerns, a map's Driving Times, ...) — disc
// bullets, consistent indent/spacing/color, instead of each place that
// happens to render a <ul> ending up with its own ad hoc (or entirely
// un-reset browser default) spacing. Callers provide their own <li>
// children — a plain string, a link, a "loading" placeholder, whatever
// that particular list's items need to be.
export default function BulletList({ children }: BulletListProps) {
  return <ul className={styles.bulletList}>{children}</ul>;
}
