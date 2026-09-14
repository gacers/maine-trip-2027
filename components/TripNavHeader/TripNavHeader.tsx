"use client";

import { useLayoutEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  NavigationMenu,
  NavigationMenuList,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuTrigger,
  NavigationMenuContent,
  NavigationMenuViewportWrapper,
} from "@/components/NavigationMenu";
import type { PublicTrip, NavGroup } from "@/lib/types";
import styles from "./TripNavHeader.module.css";

export interface TripNavHeaderProps {
  trip: PublicTrip;
  nav: NavGroup[];
}

// `nav` is this trip's nav_groups, each with its member `sections`
// already attached and sorted (see lib/sections.js's getTripNav) —
// entirely data-driven per trip, replacing the old hardcoded
// GROUPS/COLLECTIONS constants. One single sticky bar: trip name on
// the left, each nav group as a dropdown menu (its sections underneath,
// via Radix's real Trigger/Content/Viewport), utility links on the
// right — no separate title banner above it.
export default function TripNavHeader({ trip, nav: allNav }: TripNavHeaderProps) {
  const pathname = usePathname();
  const barRef = useRef<HTMLElement>(null);
  const sectionPath = (slug: string) => `/${trip.slug}/${slug}`;

  // This bar's own rendered height, published as a CSS variable on the
  // document root so anything sticky further down the tree (SectionPage's
  // filter dropdown, which isn't a DOM sibling of this component) can
  // stick right below it instead of guessing a fixed offset —
  // recalculated on resize since it can wrap taller at narrow widths.
  useLayoutEffect(() => {
    const el = barRef.current;
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
    <header ref={barRef} className={styles.bar}>
      <div className={styles.barInner}>
        <Link href={sectionPath(nav[0]?.sections[0]?.slug || "")} className={styles.brand}>
          {trip.name}
        </Link>

        {nav.length > 0 && (
          <NavigationMenu className={styles.menu} aria-label="Trip sections">
            <NavigationMenuList>
              {nav.map((g) =>
                g.sections.length > 1 ? (
                  <NavigationMenuItem key={g.id}>
                    <NavigationMenuTrigger active={g.id === activeGroup?.id}>{g.label}</NavigationMenuTrigger>
                    <NavigationMenuContent>
                      {g.sections.map((s) => (
                        <NavigationMenuLink
                          key={s.id}
                          asChild
                          size="menuItem"
                          active={pathname === sectionPath(s.slug)}
                        >
                          <Link href={sectionPath(s.slug)}>{s.sub_nav_label || s.label}</Link>
                        </NavigationMenuLink>
                      ))}
                    </NavigationMenuContent>
                  </NavigationMenuItem>
                ) : (
                  <NavigationMenuItem key={g.id}>
                    <NavigationMenuLink asChild active={g.id === activeGroup?.id}>
                      <Link href={sectionPath(g.sections[0].slug)}>{g.label}</Link>
                    </NavigationMenuLink>
                  </NavigationMenuItem>
                )
              )}
            </NavigationMenuList>
            <NavigationMenuViewportWrapper />
          </NavigationMenu>
        )}

        <div className={styles.actions}>
          <Link href="/" className={styles.actionLink}>
            All trips
          </Link>
          <Link href={`/${trip.slug}/admin/sections`} className={styles.manageLink}>
            Manage
          </Link>
        </div>
      </div>
    </header>
  );
}
