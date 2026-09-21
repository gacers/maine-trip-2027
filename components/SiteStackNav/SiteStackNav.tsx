"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NavigationMenu, NavigationMenuList, NavigationMenuItem, NavigationMenuLink } from "@/components/NavigationMenu";
import { SITE_CATEGORIES } from "@/lib/siteCategories";
import styles from "./SiteStackNav.module.css";

export interface SiteStackNavProps {
  /** When set, show Stays / Food & Drink / … tabs under the stack. */
  categoryBasePath?: "/categories" | "/future-interest";
  categorySlug?: string;
  /** Extra controls on the category row (e.g. Future Interest +Add). */
  categoryActions?: ReactNode;
}

const STACK = [
  { href: "/", label: "Trips", match: (path: string) => path === "/" },
  { href: "/categories/stays", label: "Categories", match: (path: string) => path.startsWith("/categories") },
  {
    href: "/future-interest/stays",
    label: "Future Interest",
    match: (path: string) => path.startsWith("/future-interest"),
  },
] as const;

// Sticky Trips | Categories | Future Interest bar for the home surface
// only (see app/(home)/layout). Category sub-tabs appear under it on
// Categories / Future Interest routes.
export default function SiteStackNav({ categoryBasePath, categorySlug, categoryActions }: SiteStackNavProps) {
  const pathname = usePathname();

  return (
    <div className={styles["sticky-nav"]}>
      <div className={styles["nav-row"]}>
        <NavigationMenu className={styles["menu"]} aria-label="Site sections">
          <NavigationMenuList>
            {STACK.map((item) => (
              <NavigationMenuItem key={item.href}>
                <NavigationMenuLink asChild active={item.match(pathname)}>
                  <Link href={item.href}>{item.label}</Link>
                </NavigationMenuLink>
              </NavigationMenuItem>
            ))}
          </NavigationMenuList>
        </NavigationMenu>
      </div>

      {categoryBasePath && (
        <div className={styles["sub-nav-row"]}>
          <NavigationMenu className={styles["menu"]} aria-label="Categories">
            <NavigationMenuList>
              {SITE_CATEGORIES.map((c) => (
                <NavigationMenuItem key={c.slug}>
                  <NavigationMenuLink asChild size="sm" active={categorySlug === c.slug}>
                    <Link href={`${categoryBasePath}/${c.slug}`}>{c.label}</Link>
                  </NavigationMenuLink>
                </NavigationMenuItem>
              ))}
            </NavigationMenuList>
          </NavigationMenu>
          {categoryActions ? <div className={styles["sub-nav-actions"]}>{categoryActions}</div> : null}
        </div>
      )}
    </div>
  );
}
