"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NavigationMenu, NavigationMenuList, NavigationMenuItem, NavigationMenuLink } from "@/components/NavigationMenu";
import { SITE_CATEGORIES, type SiteCategorySlug } from "@/lib/siteCategories";
import SiteStackMobileDrawer from "./SiteStackMobileDrawer";
import styles from "./SiteStackNav.module.css";

export type SiteCategoryBasePath = "/categories" | "/future-interests" | "/places";

export interface SiteStackNavProps {
  /** When set, show Stays / Food & Drink / … tabs under the stack. */
  categoryBasePath?: SiteCategoryBasePath;
  categorySlug?: string;
  /** Extra controls on the category row (e.g. Future Interests / Places +Add). */
  categoryActions?: ReactNode;
  /** Manage link when on Categories / Future Interests / Places. */
  manageHref?: string;
  /** Override which category tabs appear (Places can hide some). */
  categoryTabs?: readonly { slug: SiteCategorySlug; label: string }[];
}

const STACK = [
  { href: "/", label: "Trips", match: (path: string) => path === "/" },
  { href: "/categories/stays", label: "Categories", match: (path: string) => path.startsWith("/categories") },
  {
    href: "/places",
    label: "Places",
    match: (path: string) => path.startsWith("/places"),
  },
  {
    href: "/future-interests/stays",
    label: "Future Interests",
    match: (path: string) => path.startsWith("/future-interests"),
  },
] as const;

// Sticky Trips | Categories | Places | Future Interests bar for the home
// surface only (see app/(home)/layout). Same collapse as trip
// TripNavHeader: below 1024px only the hamburger (+ Add when present)
// stays visible.
export default function SiteStackNav({
  categoryBasePath,
  categorySlug,
  categoryActions,
  manageHref,
  categoryTabs,
}: SiteStackNavProps) {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const tabs = categoryTabs ?? SITE_CATEGORIES;

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    function onChange() {
      if (mq.matches) setDrawerOpen(false);
    }
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return (
    <div className={styles["sticky-nav"]}>
      <div className={styles["menu-mobile"]}>
        <SiteStackMobileDrawer
          pathname={pathname}
          open={drawerOpen}
          onOpenChange={setDrawerOpen}
          manageHref={manageHref}
          placesCategoryTabs={categoryBasePath === "/places" ? tabs : undefined}
        />
        <div className={styles["mobile-actions"]}>
          {manageHref ? (
            <Link href={manageHref} className={styles["manage-link"]}>
              Manage
            </Link>
          ) : null}
          {categoryActions}
        </div>
      </div>

      <div className={styles["menu-desktop"]}>
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
          {manageHref ? (
            <Link href={manageHref} className={styles["manage-link"]}>
              Manage
            </Link>
          ) : null}
        </div>

        {categoryBasePath && (
          <div className={styles["sub-nav-row"]}>
            <NavigationMenu className={styles["menu"]} aria-label="Categories">
              <NavigationMenuList>
                {tabs.map((c) => (
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
    </div>
  );
}
