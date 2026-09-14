"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { PublicTrip, NavGroup } from "@/lib/types";
import styles from "./TripNavHeader.module.css";

function pillClasses(active: boolean, size: "large" | "small" = "large") {
  const sizeClass = size === "small" ? styles.pillSmall : styles.pillLarge;
  return `${sizeClass} ${active ? styles.pillActive : styles.pillInactive}`;
}

export interface TripNavHeaderProps {
  trip: PublicTrip;
  nav: NavGroup[];
}

// `nav` is this trip's nav_groups, each with its member `sections`
// already attached and sorted (see lib/sections.js's getTripNav) —
// entirely data-driven per trip, replacing the old hardcoded
// GROUPS/COLLECTIONS constants.
export default function TripNavHeader({ trip, nav: allNav }: TripNavHeaderProps) {
  const pathname = usePathname();
  const sectionPath = (slug: string) => `/${trip.slug}/${slug}`;

  // A nav group with zero *enabled* sections (all disabled, all deleted,
  // or none added yet) has nothing to link to — skip it rather than
  // render a link to "/{trip}/undefined". Disabled sections stay fully
  // configured/queryable (see the admin sections list), just hidden
  // from this public-facing nav.
  const nav = allNav
    .map((g) => ({ ...g, sections: g.sections.filter((s) => s.enabled) }))
    .filter((g) => g.sections.length > 0);
  const activeGroup =
    nav.find((g) => g.sections.some((s) => sectionPath(s.slug) === pathname)) || nav[0];

  return (
    <header className={styles.header}>
      <div className={styles.topLinks}>
        <Link href="/" className={styles.topLink}>
          &larr; All trips
        </Link>
        <Link href={`/${trip.slug}/admin/sections`} className={styles.topLink}>
          Manage
        </Link>
      </div>
      <h1 className={styles.tripName}>{trip.name}</h1>

      {nav.length > 0 && (
        <nav className={styles.navRow}>
          {nav.map((g) => (
            <Link
              key={g.id}
              href={sectionPath(g.sections[0]?.slug)}
              className={pillClasses(g.id === activeGroup?.id)}
            >
              {g.label}
            </Link>
          ))}
        </nav>
      )}

      {activeGroup && activeGroup.sections.length > 0 && (
        <nav className={styles.navRow}>
          {activeGroup.sections.map((s) => (
            <Link
              key={s.id}
              href={sectionPath(s.slug)}
              className={pillClasses(pathname === sectionPath(s.slug), "small")}
            >
              {s.sub_nav_label || s.label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}
