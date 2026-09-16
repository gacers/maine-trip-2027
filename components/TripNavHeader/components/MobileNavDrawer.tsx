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
}

// Replaces the old anchored Radix DropdownMenu — a small popover reads
// fine for a short flat list, but confirmed live as too cramped once
// there's more than a couple of groups. A full-screen panel instead,
// with real tap targets. Nav links only — this section's own action
// row (Add/Google Sheet/Sort/filter) stays visible in the header
// itself, same row as this drawer's own trigger, at every width; an
// earlier version tried relocating it in here while open, confirmed
// live as more annoying than useful (it disappeared from the header
// the moment the drawer closed, on top of "go up a level, not into the
// hamburger" being the more obviously useful shape for it anyway).
export default function MobileNavDrawer({ nav, pathname, sectionPath, open, onOpenChange }: MobileNavDrawerProps) {
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
