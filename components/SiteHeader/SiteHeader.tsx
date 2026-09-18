"use client";

import type { ReactNode } from "react";
import classNames from "classnames";
import styles from "./SiteHeader.module.css";

export interface SiteHeaderProps {
  /** Left side — site name on All Trips, breadcrumb on a trip page. */
  brand: ReactNode;
  /** Right side — Login / Logout / Manage / Create login. */
  actions?: ReactNode;
  /** All Trips pins this bar while scrolling; trip pages leave it
   * free so only the category sticky-nav sticks. */
  sticky?: boolean;
  className?: string;
}

// Shared top chrome for All Trips and every trip page — full viewport
// width with the same side padding (no max-width inner), so "Country
// Goth Travel" and "All Trips › …" line up. Sticky category nav stays
// in TripNavHeader below this.
export default function SiteHeader({ brand, actions, sticky = false, className }: SiteHeaderProps) {
  return (
    <header className={classNames(styles["root"], sticky && styles["sticky"], className)}>
      <div className={styles["top-row"]}>
        <div className={styles["brand"]}>{brand}</div>
        {actions ? <div className={styles["actions"]}>{actions}</div> : null}
      </div>
    </header>
  );
}

export { styles as siteHeaderStyles };
