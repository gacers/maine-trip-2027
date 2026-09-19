"use client";

import Link from "next/link";
import { Dialog, DialogTrigger, DialogContent, DialogTitle, DialogClose } from "@/components/Dialog";
import Button from "@/components/Button";
import type { NavGroup } from "@/lib/types";
import styles from "./MobileNavDrawer.module.css";

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

export interface MobileNavDrawerProps {
  nav: NavGroup[];
  pathname: string;
  sectionPath: (navGroupSlug: string, sectionSlug: string) => string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** A fixed link outside the nav_groups/sections data model — the
   * Itinerary page, currently the only one — shown above the trip's
   * own category groups. */
  extraLink?: { href: string; label: string };
  /** Slot for section actions (Sheet/Sort/Filter) — UtilityControls
   * portals into this below 1024px so those stay out of the sticky
   * header (only +Add remains next to the hamburger). */
  onActionsSlotChange?: (el: HTMLDivElement | null) => void;
}

// Replaces the old anchored Radix DropdownMenu — a small popover reads
// fine for a short flat list, but confirmed live as too cramped once
// there's more than a couple of groups. A full-screen panel instead,
// with real tap targets. Category/section links live here; below
// 1024px so do Sheet/Sort/Filter (portaled via onActionsSlotChange) —
// only +Add stays in the sticky header next to the hamburger.
export default function MobileNavDrawer({
  nav,
  pathname,
  sectionPath,
  open,
  onOpenChange,
  extraLink,
  onActionsSlotChange,
}: MobileNavDrawerProps) {
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

        <div ref={(el) => onActionsSlotChange?.(el)} className={styles["actions-slot"]} />

        <nav className={styles["nav-groups"]} aria-label="Trip categories">
          {extraLink && (
            <DialogClose asChild>
              <Link href={extraLink.href} className={pathname === extraLink.href ? styles["nav-link-active"] : styles["nav-link"]}>
                {extraLink.label}
              </Link>
            </DialogClose>
          )}
          {nav.map((g) => (
            <div key={g.id} className={styles["nav-group"]}>
              <div className={styles["nav-group-label"]}>{g.label}</div>
              {g.sections.map((s) => {
                const href = sectionPath(g.slug, s.slug);
                return (
                  <DialogClose asChild key={s.id}>
                    <Link href={href} className={pathname === href ? styles["nav-link-active"] : styles["nav-link"]}>
                      {s.sub_nav_label || s.label}
                    </Link>
                  </DialogClose>
                );
              })}
            </div>
          ))}
        </nav>
      </DialogContent>
    </Dialog>
  );
}
