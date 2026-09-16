"use client";

import Link from "next/link";
import { Dialog, DialogTrigger, DialogContent, DialogTitle, DialogClose } from "@/components/Dialog";
import Button from "@/components/Button";
import { useNavSlot } from "../NavSlot";
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
  activeGroupId?: string;
  pathname: string;
  sectionPath: (navGroupSlug: string, sectionSlug: string) => string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Replaces the old anchored Radix DropdownMenu — a small popover reads
// fine for a short flat list, but confirmed live as too cramped once
// there's more than a couple of groups, and had no room for anything
// but nav links. A full-screen panel instead, with real tap targets,
// and — while it's open — this section's own action row (Add/Google
// Sheet/Sort/filter, normally pinned in the sticky header via NavSlot)
// relocates in here too, so it's one single place for both nav and
// what you'd actually do on the page, not a popover plus a separate
// always-on toolbar row competing for the same narrow header. Closing
// the drawer (or navigating away) moves that toolbar right back to its
// usual spot — see TripNavHeader's own `drawerOpen`-gated nav-slot
// target for how that handoff works.
export default function MobileNavDrawer({ nav, activeGroupId, pathname, sectionPath, open, onOpenChange }: MobileNavDrawerProps) {
  const navSlot = useNavSlot();
  const activeGroup = nav.find((g) => g.id === activeGroupId);

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

        {/* This section's own actions — only exists at all once you're
            actually on a section with something to show here (see
            UtilityControls' own gating in SectionPage); an empty trip
            with nothing added yet just skips straight to nav links. */}
        {activeGroup && (
          <div className={styles["actions-section"]}>
            <div ref={(el) => navSlot?.setSlot(el)} className={styles["actions-target"]} />
          </div>
        )}

        <nav className={styles["nav-groups"]} aria-label="Trip categories">
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
