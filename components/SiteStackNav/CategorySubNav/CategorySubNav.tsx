"use client";

import { memo, type ReactNode } from "react";
import Link from "next/link";
import { NavigationMenu, NavigationMenuList, NavigationMenuItem, NavigationMenuLink } from "@/components/NavigationMenu";
import styles from "../SiteStackNav.module.css";

export type CategorySubNavBasePath = "/categories" | "/future-interests" | "/places";

export interface CategorySubNavProps {
  categoryBasePath: CategorySubNavBasePath;
  tabs: readonly { slug: string; label: string }[];
  activeCategorySlug?: string;
  categoryActions?: ReactNode;
  onNavigate: (href: string) => void;
  onWarm: (slug: string, href: string) => void;
}

function sameTabs(
  a: readonly { slug: string; label: string }[],
  b: readonly { slug: string; label: string }[]
) {
  if (a.length !== b.length) return false;
  return a.every((t, i) => t.slug === b[i].slug && t.label === b[i].label);
}

/** Stays / Food & Drink / … row — memoized so only active slug / actions
 * updates re-render the pills, not every parent chrome refresh. */
function CategorySubNav({
  categoryBasePath,
  tabs,
  activeCategorySlug,
  categoryActions,
  onNavigate,
  onWarm,
}: CategorySubNavProps) {
  return (
    <div className={styles["sub-nav-row"]}>
      <NavigationMenu className={styles["menu"]} aria-label="Categories">
        <NavigationMenuList>
          {tabs.map((c, i) => {
            const href = `${categoryBasePath}/${c.slug}`;
            return (
              <NavigationMenuItem key={i}>
                <NavigationMenuLink asChild size="sm" active={activeCategorySlug === c.slug}>
                  <Link
                    href={href}
                    onPointerEnter={() => onWarm(c.slug, href)}
                    onClick={() => onNavigate(href)}
                  >
                    {c.label}
                  </Link>
                </NavigationMenuLink>
              </NavigationMenuItem>
            );
          })}
        </NavigationMenuList>
      </NavigationMenu>
      {/* Always reserve the actions slot so +Add appearing doesn't reflow the row. */}
      <div className={styles["sub-nav-actions"]}>{categoryActions}</div>
    </div>
  );
}

export default memo(CategorySubNav, (prev, next) => {
  if (prev.categoryBasePath !== next.categoryBasePath) return false;
  if (prev.activeCategorySlug !== next.activeCategorySlug) return false;
  if (prev.categoryActions !== next.categoryActions) return false;
  if (!sameTabs(prev.tabs, next.tabs)) return false;
  return true;
});
