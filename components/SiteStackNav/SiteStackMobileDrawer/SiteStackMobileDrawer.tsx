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
}

// Same Dialog drawer as trip MobileNavDrawer — Trips / Categories /
// Future Interest plus each category tab in one mobile menu.
export default function SiteStackMobileDrawer({ pathname, open, onOpenChange }: SiteStackMobileDrawerProps) {
  const onTrips = pathname === "/";
  const onCategories = pathname.startsWith("/categories");
  const onFutureInterest = pathname.startsWith("/future-interest");

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
              <Link
                href="/future-interest/stays"
                className={onFutureInterest ? styles["nav-link-active"] : styles["nav-link"]}
              >
                Future Interest
              </Link>
            </DialogClose>
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

          <div className={styles["nav-group"]}>
            <div className={styles["nav-group-label"]}>Future Interest</div>
            {SITE_CATEGORIES.map((c) => {
              const href = `/future-interest/${c.slug}`;
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
        </nav>
      </DialogContent>
    </Dialog>
  );
}
