"use client";

import { useLayoutEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NavigationMenu, NavigationMenuList, NavigationMenuItem, NavigationMenuLink } from "@/components/NavigationMenu";
import type { PublicTrip, NavGroup } from "@/lib/types";
import styles from "./TripNavHeader.module.css";

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
  const navBarRef = useRef<HTMLDivElement>(null);
  const sectionPath = (slug: string) => `/${trip.slug}/${slug}`;

  // The sticky nav bar's own rendered height, published as a CSS
  // variable on the document root so anything sticky further down the
  // tree (SectionPage's filter dropdown, which isn't a DOM sibling of
  // this component) can stick right below it instead of guessing a
  // fixed offset — recalculated on resize since the bar wraps to more
  // rows at narrow widths/long labels.
  useLayoutEffect(() => {
    const el = navBarRef.current;
    if (!el) return;
    const setHeight = () => document.documentElement.style.setProperty("--sticky-nav-height", `${el.offsetHeight}px`);
    setHeight();
    const observer = new ResizeObserver(setHeight);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

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
    <header>
      <div className={styles.topArea}>
        <div className={styles.topLinks}>
          <Link href="/" className={styles.topLink}>
            &larr; All trips
          </Link>
          <Link href={`/${trip.slug}/admin/sections`} className={styles.topLink}>
            Manage
          </Link>
        </div>
        <h1 className={styles.tripName}>{trip.name}</h1>
      </div>

      {nav.length > 0 && (
        <div ref={navBarRef} className={styles.navBar}>
          <NavigationMenu aria-label="Trip sections">
            <NavigationMenuList>
              {nav.map((g) => (
                <NavigationMenuItem key={g.id}>
                  <NavigationMenuLink asChild active={g.id === activeGroup?.id}>
                    <Link href={sectionPath(g.sections[0]?.slug)}>{g.label}</Link>
                  </NavigationMenuLink>
                </NavigationMenuItem>
              ))}
            </NavigationMenuList>
          </NavigationMenu>

          {/* The active group's own sections — reads as a sub-menu
              appearing underneath the top-level row above. */}
          {activeGroup && activeGroup.sections.length > 0 && (
            <NavigationMenu aria-label={`${activeGroup.label} sections`} className={styles.subNav}>
              <NavigationMenuList>
                {activeGroup.sections.map((s) => (
                  <NavigationMenuItem key={s.id}>
                    <NavigationMenuLink asChild size="sm" active={pathname === sectionPath(s.slug)}>
                      <Link href={sectionPath(s.slug)}>{s.sub_nav_label || s.label}</Link>
                    </NavigationMenuLink>
                  </NavigationMenuItem>
                ))}
              </NavigationMenuList>
            </NavigationMenu>
          )}
        </div>
      )}
    </header>
  );
}
