"use client";

import { memo } from "react";
import Link from "next/link";
import { NavigationMenu, NavigationMenuList, NavigationMenuItem, NavigationMenuLink } from "@/components/NavigationMenu";
import type { NavGroup } from "@/lib/types";
import styles from "../TripNavHeader.module.css";

export interface TripSubNavProps {
  group: NavGroup;
  path: string;
  tripSlug: string;
  go: (href: string) => void;
  prefetch: (href: string) => void;
}

function sectionHref(tripSlug: string, groupSlug: string, sectionSlug: string) {
  return `/${tripSlug}/${groupSlug}/${sectionSlug}`;
}

function sameSections(a: NavGroup["sections"], b: NavGroup["sections"]) {
  if (a.length !== b.length) return false;
  return a.every((s, i) => {
    const t = b[i];
    return (
      s.id === t.id &&
      s.slug === t.slug &&
      (s.sub_nav_label || s.label) === (t.sub_nav_label || t.label)
    );
  });
}

/** Second-level Possible/Previous row — memoized so force-dynamic layout
 * refreshes don't remount the pills on every soft navigation. */
function TripSubNav({ group, path, tripSlug, go, prefetch }: TripSubNavProps) {
  if (group.sections.length < 2) return null;

  return (
    <div className={styles["sub-nav-row"]}>
      <NavigationMenu className={styles["sub-nav-menu"]} aria-label={`${group.label} sections`}>
        <NavigationMenuList>
          {group.sections.map((s, i) => {
            const href = sectionHref(tripSlug, group.slug, s.slug);
            return (
              // Index keys: swapping groups with the same Possible/Previous
              // shape updates labels/hrefs in place instead of remounting.
              <NavigationMenuItem key={i}>
                <NavigationMenuLink asChild size="sm" active={path === href}>
                  <Link
                    href={href}
                    onPointerEnter={() => prefetch(href)}
                    onClick={() => go(href)}
                  >
                    {s.sub_nav_label || s.label}
                  </Link>
                </NavigationMenuLink>
              </NavigationMenuItem>
            );
          })}
        </NavigationMenuList>
      </NavigationMenu>
    </div>
  );
}

export default memo(TripSubNav, (prev, next) => {
  if (prev.path !== next.path) return false;
  if (prev.tripSlug !== next.tripSlug) return false;
  if (prev.group.id !== next.group.id || prev.group.slug !== next.group.slug) return false;
  if (!sameSections(prev.group.sections, next.group.sections)) return false;
  return true;
});
