"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import SiteHeader, { siteHeaderStyles } from "@/components/SiteHeader";
import SiteStackNav, { type SiteCategoryBasePath } from "@/components/SiteStackNav";
import LoginPrompt from "@/components/LoginPrompt";
import LogoutButton from "@/components/LogoutButton";
import CreateLoginPrompt from "@/components/CreateLoginPrompt";
import Button from "@/components/Button";
import { listInviteTripSlugs, readInviteToken } from "@/lib/inviteClient";
import { SITE_CATEGORIES, isSiteCategorySlug } from "@/lib/siteCategories";
import { useOptimisticPath } from "@/lib/useOptimisticPath";
import { useHomeActions } from "./HomeActions";
import styles from "./HomeShell.module.css";

export interface HomeShellProps {
  isAdmin: boolean;
  isSignedIn: boolean;
  placesCategoryTabs?: readonly { slug: string; label: string }[];
  futureInterestsCategoryTabs?: readonly { slug: string; label: string }[];
  children: ReactNode;
}

function manageHrefFor(path: string): string | undefined {
  if (path.startsWith("/categories")) return "/categories/manage";
  if (path.startsWith("/future-interests")) return "/future-interests/manage";
  if (path.startsWith("/places")) return "/places/manage";
  return undefined;
}

// Shared chrome for `/`, `/categories/*`, `/future-interests/*`,
// `/places/*` — header always; stack nav for admins only.
export default function HomeShell({
  isAdmin,
  isSignedIn,
  placesCategoryTabs,
  futureInterestsCategoryTabs,
  children,
}: HomeShellProps) {
  const { path: pathname, go, prefetch } = useOptimisticPath();
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
  if (categorySlug === "manage") {
    categorySlug = undefined;
    categoryBasePath = undefined;
  }
  // Categories browse still uses the fixed SITE_CATEGORIES list.
  if (categoryBasePath === "/categories" && categorySlug && !isSiteCategorySlug(categorySlug)) {
    categorySlug = undefined;
    categoryBasePath = undefined;
  }

  const placesTabs = placesCategoryTabs ?? SITE_CATEGORIES;
  const fiTabs = futureInterestsCategoryTabs ?? SITE_CATEGORIES;
  const placesHref = placesTabs[0] ? `/places/${placesTabs[0].slug}` : "/places/manage";
  const futureInterestsHref = fiTabs[0]
    ? `/future-interests/${fiTabs[0].slug}`
    : "/future-interests/manage";
  const categoryTabs =
    categoryBasePath === "/places"
      ? placesTabs
      : categoryBasePath === "/future-interests"
        ? fiTabs
        : undefined;

  const showAdd =
    categoryBasePath === "/future-interests" || categoryBasePath === "/places";

  useEffect(() => {
    if (showAdd) return;
    homeActions?.setCategoryActions(null);
  }, [showAdd, homeActions]);

  return (
    <>
      <div className={styles["sticky-chrome"]}>
        <SiteHeader
          brand={
            <Link href="/" className={siteHeaderStyles["brand-title"]}>
              Country Goth Travel
            </Link>
          }
          actions={
            isAdmin ? (
              <>
                <Button variant="secondary" size="sm" asChild>
                  <Link href="/trips/new">+ New trip</Link>
                </Button>
                <Button variant="secondary" size="sm" asChild>
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
            pathname={pathname}
            onNavigate={go}
            onPrefetch={prefetch}
            categoryBasePath={categoryBasePath}
            categorySlug={categorySlug}
            categoryActions={showAdd ? homeActions?.categoryActions : undefined}
            manageHref={manageHrefFor(pathname)}
            categoryTabs={categoryTabs}
            placesCategoryTabs={placesTabs}
            futureInterestsCategoryTabs={fiTabs}
            placesHref={placesHref}
            futureInterestsHref={futureInterestsHref}
          />
        ) : null}
      </div>
      {children}
    </>
  );
}
