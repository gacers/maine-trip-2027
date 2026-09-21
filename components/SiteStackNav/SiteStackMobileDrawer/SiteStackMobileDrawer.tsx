"use client";

import Link from "next/link";
import { Dialog, DialogTrigger, DialogContent, DialogTitle, DialogClose } from "@/components/Dialog";
import Button from "@/components/Button";
import { SITE_CATEGORIES } from "@/lib/siteCategories";
import styles from "./SiteStackMobileDrawer.module.css";

function MenuIcon() {
  return (
    <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

export interface SiteStackMobileDrawerProps {
  pathname: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  manageHref?: string;
  placesCategoryTabs?: readonly { slug: string; label: string }[];
  futureInterestsCategoryTabs?: readonly { slug: string; label: string }[];
}

// Same Dialog drawer as trip MobileNavDrawer — Trips / Categories /
// Places / Future Interests plus each category tab in one mobile menu.
export default function SiteStackMobileDrawer({
  pathname,
  open,
  onOpenChange,
  manageHref,
  placesCategoryTabs,
  futureInterestsCategoryTabs,
}: SiteStackMobileDrawerProps) {
  const onTrips = pathname === "/";
  const onCategories = pathname.startsWith("/categories");
  const onFutureInterest = pathname.startsWith("/future-interests");
  const onPlaces = pathname.startsWith("/places");
  const placesTabs = placesCategoryTabs ?? SITE_CATEGORIES;
  const fiTabs = futureInterestsCategoryTabs ?? SITE_CATEGORIES;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" aria-label="Menu" className={styles["hamburger-button"]}>
          <MenuIcon />
        </Button>
      </DialogTrigger>
      <DialogContent className={styles["drawer"]}>
        <div className={styles["drawer-header"]}>
          <DialogTitle className={styles["drawer-title"]}>Menu</DialogTitle>
          <DialogClose asChild>
            <Button variant="ghost" size="sm" aria-label="Close menu" className={styles["close-button"]}>
              <CloseIcon />
            </Button>
          </DialogClose>
        </div>

        <nav className={styles["nav-groups"]} aria-label="Site sections">
          <div className={styles["nav-group"]}>
            <div className={styles["nav-group-label"]}>Site</div>
            <DialogClose asChild>
              <Link href="/" className={onTrips ? styles["nav-link-active"] : styles["nav-link"]}>
                Trips
              </Link>
            </DialogClose>
            <DialogClose asChild>
              <Link href="/categories/stays" className={onCategories ? styles["nav-link-active"] : styles["nav-link"]}>
                Categories
              </Link>
            </DialogClose>
            <DialogClose asChild>
              <Link href="/places" className={onPlaces ? styles["nav-link-active"] : styles["nav-link"]}>
                Places
              </Link>
            </DialogClose>
            <DialogClose asChild>
              <Link href="/future-interests" className={onFutureInterest ? styles["nav-link-active"] : styles["nav-link"]}>
                Future Interests
              </Link>
            </DialogClose>
            {manageHref ? (
              <DialogClose asChild>
                <Link href={manageHref} className={styles["nav-link"]}>
                  Manage
                </Link>
              </DialogClose>
            ) : null}
          </div>

          <div className={styles["nav-group"]}>
            <div className={styles["nav-group-label"]}>Categories</div>
            {SITE_CATEGORIES.map((c) => {
              const href = `/categories/${c.slug}`;
              const active = pathname === href;
              return (
                <DialogClose asChild key={`cat-${c.slug}`}>
                  <Link href={href} className={active ? styles["nav-link-active"] : styles["nav-link"]}>
                    {c.label}
                  </Link>
                </DialogClose>
              );
            })}
          </div>

          {placesTabs.length > 0 ? (
            <div className={styles["nav-group"]}>
              <div className={styles["nav-group-label"]}>Places</div>
              {placesTabs.map((c) => {
                const href = `/places/${c.slug}`;
                const active = pathname === href;
                return (
                  <DialogClose asChild key={`pl-${c.slug}`}>
                    <Link href={href} className={active ? styles["nav-link-active"] : styles["nav-link"]}>
                      {c.label}
                    </Link>
                  </DialogClose>
                );
              })}
            </div>
          ) : null}

          {fiTabs.length > 0 ? (
            <div className={styles["nav-group"]}>
              <div className={styles["nav-group-label"]}>Future Interests</div>
              {fiTabs.map((c) => {
                const href = `/future-interests/${c.slug}`;
                const active = pathname === href;
                return (
                  <DialogClose asChild key={`fi-${c.slug}`}>
                    <Link href={href} className={active ? styles["nav-link-active"] : styles["nav-link"]}>
                      {c.label}
                    </Link>
                  </DialogClose>
                );
              })}
            </div>
          ) : null}
        </nav>
      </DialogContent>
    </Dialog>
  );
}
