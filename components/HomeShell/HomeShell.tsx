"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import SiteHeader, { siteHeaderStyles } from "@/components/SiteHeader";
import SiteStackNav, { type SiteCategoryBasePath } from "@/components/SiteStackNav";
import LoginPrompt from "@/components/LoginPrompt";
import LogoutButton from "@/components/LogoutButton";
import CreateLoginPrompt from "@/components/CreateLoginPrompt";
import Button from "@/components/Button";
import { listInviteTripSlugs, readInviteToken } from "@/lib/inviteClient";
import { SITE_CATEGORIES, isSiteCategorySlug, type SiteCategorySlug } from "@/lib/siteCategories";
import { useHomeActions } from "./HomeActions";
import styles from "./HomeShell.module.css";

export interface HomeShellProps {
  isAdmin: boolean;
  isSignedIn: boolean;
  /** Places Manage can hide some category tabs. */
  placesEnabledCategories?: SiteCategorySlug[];
  children: ReactNode;
}

function manageHrefFor(path: string): string | undefined {
  if (path.startsWith("/categories")) return "/categories/manage";
  if (path.startsWith("/future-interests")) return "/future-interests/manage";
  if (path.startsWith("/places")) return "/places/manage";
  return undefined;
}

// Shared chrome for `/`, `/categories/*`, `/future-interests/*`,
// `/places/*` — header always; stack nav for admins only. Category
// sub-tabs appear automatically from the path. FI / Places +Add
// portals in via useHomeActions().
export default function HomeShell({
  isAdmin,
  isSignedIn,
  placesEnabledCategories,
  children,
}: HomeShellProps) {
  const pathname = usePathname();
  const homeActions = useHomeActions();
  const [inviteSlug, setInviteSlug] = useState<string | null>(null);
  const [inviteToken, setInviteToken] = useState<string | null>(null);

  useEffect(() => {
    const slugs = listInviteTripSlugs();
    const first = slugs[0] || null;
    setInviteSlug(first);
    setInviteToken(first ? readInviteToken(first) : null);
  }, []);

  const showInviteAuth = !isSignedIn && !!inviteToken && !!inviteSlug;

  const authActions = isSignedIn ? (
    <LogoutButton />
  ) : showInviteAuth ? (
    <div className={siteHeaderStyles["invite-access"]}>
      <div className={siteHeaderStyles["invite-access-links"]}>
        <LoginPrompt hasInviteAccess contributorToken={inviteToken} tripSlug={inviteSlug!} />
        <CreateLoginPrompt trip={{ slug: inviteSlug! }} contributorToken={inviteToken!} />
      </div>
      <p className={siteHeaderStyles["invite-access-hint"]}>(current access via browser cookie)</p>
    </div>
  ) : (
    <LoginPrompt />
  );

  let categoryBasePath: SiteCategoryBasePath | undefined;
  let categorySlug: string | undefined;
  if (pathname.startsWith("/categories/")) {
    categoryBasePath = "/categories";
    categorySlug = pathname.split("/")[2];
  } else if (pathname.startsWith("/future-interests/")) {
    categoryBasePath = "/future-interests";
    categorySlug = pathname.split("/")[2];
  } else if (pathname.startsWith("/places/")) {
    categoryBasePath = "/places";
    categorySlug = pathname.split("/")[2];
  }
  // manage pages have no category slug tab row
  if (categorySlug === "manage") {
    categorySlug = undefined;
    categoryBasePath = undefined;
  }
  if (categorySlug && !isSiteCategorySlug(categorySlug)) {
    categorySlug = undefined;
    categoryBasePath = undefined;
  }

  const placesTabs =
    placesEnabledCategories && placesEnabledCategories.length > 0
      ? SITE_CATEGORIES.filter((c) => placesEnabledCategories.includes(c.slug))
      : SITE_CATEGORIES;

  const showAdd =
    categoryBasePath === "/future-interests" || categoryBasePath === "/places";

  return (
    <>
      <div className={styles["sticky-chrome"]}>
        <SiteHeader
          brand={<p className={siteHeaderStyles["brand-title"]}>Country Goth Travel</p>}
          actions={
            isAdmin ? (
              <>
                <Button variant="secondary" size="sm" asChild>
                  <Link href="/trips/new">+ New trip</Link>
                </Button>
                <Button variant="link" size="sm" asChild>
                  <Link href="/settings">Settings</Link>
                </Button>
                {authActions}
              </>
            ) : (
              authActions
            )
          }
        />
        {isAdmin ? (
          <SiteStackNav
            categoryBasePath={categoryBasePath}
            categorySlug={categorySlug}
            categoryActions={showAdd ? homeActions?.categoryActions : undefined}
            manageHref={manageHrefFor(pathname)}
            categoryTabs={categoryBasePath === "/places" ? placesTabs : undefined}
          />
        ) : null}
      </div>
      {children}
    </>
  );
}
