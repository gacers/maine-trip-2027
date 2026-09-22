"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import Button from "@/components/Button";
import { NavigationMenu, NavigationMenuList, NavigationMenuItem, NavigationMenuLink } from "@/components/NavigationMenu";
import { SITE_CATEGORIES } from "@/lib/siteCategories";
import { usePrefetchSurfaceList } from "@/lib/surfaceListQueries";
import SiteStackMobileDrawer from "./SiteStackMobileDrawer";
import styles from "./SiteStackNav.module.css";

export type SiteCategoryBasePath = "/categories" | "/future-interests" | "/places";

export interface SiteStackNavProps {
  /** Pathname used for active matching (may be optimistic). */
  pathname: string;
  /** Mark target selected immediately + prefetch RSC. */
  onNavigate: (href: string) => void;
  /** Prefetch RSC without changing active state. */
  onPrefetch: (href: string) => void;
  /** When set, show Stays / Food & Drink / … tabs under the stack. */
  categoryBasePath?: SiteCategoryBasePath;
  categorySlug?: string;
  /** Extra controls on the category row (e.g. Future Interests / Places +Add). */
  categoryActions?: ReactNode;
  /** Manage link when on Categories / Future Interests / Places. */
  manageHref?: string;
  /** Override which category tabs appear for the active surface. */
  categoryTabs?: readonly { slug: string; label: string }[];
  /** Places enabled tabs (mobile drawer Places group). */
  placesCategoryTabs?: readonly { slug: string; label: string }[];
  /** Future Interests enabled tabs (mobile drawer FI group). */
  futureInterestsCategoryTabs?: readonly { slug: string; label: string }[];
  /** First Places category path — stack link target (no /places redirect). */
  placesHref?: string;
  /** First FI category path — stack link target. */
  futureInterestsHref?: string;
}

// Sticky Trips | Categories | Places | Future Interests bar for the home
// surface only (see app/(home)/layout). Same collapse as trip
// TripNavHeader: below 1024px only the hamburger (+ Add when present)
// stays visible.
export default function SiteStackNav({
  pathname,
  onNavigate,
  onPrefetch,
  categoryBasePath,
  categorySlug,
  categoryActions,
  manageHref,
  categoryTabs,
  placesCategoryTabs,
  futureInterestsCategoryTabs,
  placesHref = "/places/stays",
  futureInterestsHref = "/future-interests/stays",
}: SiteStackNavProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const tabs = categoryTabs ?? SITE_CATEGORIES;
  const prefetchList = usePrefetchSurfaceList();

  const stack = [
    { href: "/", label: "Trips", match: (p: string) => p === "/" },
    {
      href: "/categories/stays",
      label: "Categories",
      match: (p: string) => p.startsWith("/categories"),
    },
    {
      href: placesHref,
      label: "Places",
      match: (p: string) => p.startsWith("/places"),
    },
    {
      href: futureInterestsHref,
      label: "Future Interests",
      match: (p: string) => p.startsWith("/future-interests"),
    },
  ] as const;

  // Prefer the clicked path so category pills flip before RSC lands.
  const activeCategorySlug =
    categoryBasePath && pathname.startsWith(`${categoryBasePath}/`)
      ? pathname.slice(categoryBasePath.length + 1).split("/")[0]
      : categorySlug;

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    function onChange() {
      if (mq.matches) setDrawerOpen(false);
    }
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  function warmSurface(basePath: SiteCategoryBasePath, slug: string, href: string) {
    onPrefetch(href);
    prefetchList(basePath, slug);
  }

  return (
    <div className={styles["sticky-nav"]}>
      <div className={styles["menu-mobile"]}>
        <SiteStackMobileDrawer
          pathname={pathname}
          open={drawerOpen}
          onOpenChange={setDrawerOpen}
          manageHref={manageHref}
          placesCategoryTabs={placesCategoryTabs}
          futureInterestsCategoryTabs={futureInterestsCategoryTabs}
          placesHref={placesHref}
          futureInterestsHref={futureInterestsHref}
          onNavigate={onNavigate}
        />
        <div className={styles["mobile-actions"]}>
          {manageHref ? (
            <Button variant="secondary" size="sm" asChild>
              <Link href={manageHref} onClick={() => onNavigate(manageHref)}>
                Manage
              </Link>
            </Button>
          ) : null}
          {categoryActions}
        </div>
      </div>

      <div className={styles["menu-desktop"]}>
        <div className={styles["nav-row"]}>
          <NavigationMenu className={styles["menu"]} aria-label="Site sections">
            <NavigationMenuList>
              {stack.map((item) => (
                <NavigationMenuItem key={item.label}>
                  <NavigationMenuLink asChild active={item.match(pathname)}>
                    <Link
                      href={item.href}
                      onPointerEnter={() => onPrefetch(item.href)}
                      onClick={() => onNavigate(item.href)}
                    >
                      {item.label}
                    </Link>
                  </NavigationMenuLink>
                </NavigationMenuItem>
              ))}
            </NavigationMenuList>
          </NavigationMenu>
          {manageHref ? (
            <Button variant="secondary" size="sm" asChild className={styles["manage-button"]}>
              <Link href={manageHref} onClick={() => onNavigate(manageHref)}>
                Manage
              </Link>
            </Button>
          ) : null}
        </div>

        {categoryBasePath && (
          <div className={styles["sub-nav-row"]}>
            <NavigationMenu className={styles["menu"]} aria-label="Categories">
              <NavigationMenuList>
                {tabs.map((c) => {
                  const href = `${categoryBasePath}/${c.slug}`;
                  return (
                    <NavigationMenuItem key={c.slug}>
                      <NavigationMenuLink asChild size="sm" active={activeCategorySlug === c.slug}>
                        <Link
                          href={href}
                          onPointerEnter={() => warmSurface(categoryBasePath, c.slug, href)}
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
            {categoryActions ? <div className={styles["sub-nav-actions"]}>{categoryActions}</div> : null}
          </div>
        )}
      </div>
    </div>
  );
}
