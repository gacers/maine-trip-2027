"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NavigationMenu, NavigationMenuList, NavigationMenuItem, NavigationMenuLink } from "@/components/NavigationMenu";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel } from "@/components/DropdownMenu";
import Button from "@/components/Button";
import RequestAccess from "@/components/RequestAccess";
import { captureInviteToken } from "@/lib/inviteClient";
import { useNavSlot } from "./NavSlot";
import type { PublicTrip, NavGroup } from "@/lib/types";
import styles from "./TripNavHeader.module.css";

function MenuIcon() {
  return (
    <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

export interface TripNavHeaderProps {
  trip: PublicTrip;
  nav: NavGroup[];
  isAdmin?: boolean;
  contactEmail?: string | null;
}

// `nav` is this trip's nav_groups, each with its member `sections`
// already attached and sorted (see lib/sections.js's getTripNav) —
// entirely data-driven per trip, replacing the old hardcoded
// GROUPS/COLLECTIONS constants. One single sticky bar, full width:
// trip name + utility links on their own row, then every top-level
// group (Houses, Food & Drink, Activities, ...) as a plain flat link
// on the row below — no dropdown/flyout. Landing on a group navigates
// straight to its first (normally "Possible ...") section; once you're
// on any section in that group, a second row appears underneath with
// that group's own sections (Possible/Previous), so there's always at
// most one extra row, never a hover-menu. Collapses to a single
// hamburger (a Radix DropdownMenu listing every group/section) below
// 1024px, where the flat row doesn't reliably fit. Utility links are
// gated on who's actually looking: an admin session gets "All trips"/
// "Manage", a visitor with neither that nor an invite link gets
// "Request access", and a contributor (has an invite link, isn't the
// owner) gets neither — they already have what they need on the page.
export default function TripNavHeader({ trip, nav: allNav, isAdmin = false, contactEmail = null }: TripNavHeaderProps) {
  const pathname = usePathname();
  const barRef = useRef<HTMLElement>(null);
  const navSlot = useNavSlot();
  const [contributorToken, setContributorToken] = useState<string | null>(null);
  const [accessChecked, setAccessChecked] = useState(isAdmin);
  const sectionPath = (slug: string) => `/${trip.slug}/${slug}`;

  useEffect(() => {
    setContributorToken(captureInviteToken(trip.slug));
    setAccessChecked(true);
  }, [trip.slug]);

  // This bar's own rendered height, published as a CSS variable on the
  // document root so anything sticky further down the tree (SectionPage's
  // filter/sort bar, which isn't a DOM sibling of this component) can
  // stick right below it instead of guessing a fixed offset —
  // recalculated on resize since it can wrap taller at narrow widths.
  useLayoutEffect(() => {
    const el = barRef.current;
    if (!el) return;
    const setHeight = () => document.documentElement.style.setProperty("--sticky-nav-height", `${el.offsetHeight}px`);
    setHeight();
    const observer = new ResizeObserver(setHeight);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // A nav group with zero *enabled* sections (all disabled, all deleted,
  // or none added yet) has nothing to link to — skip it rather than
  // render a link to "/{trip}/undefined". Disabled sections stay fully
  // configured/queryable (see the admin sections list), just hidden
  // from this public-facing nav.
  const nav = allNav
    .map((g) => ({ ...g, sections: g.sections.filter((s) => s.enabled) }))
    .filter((g) => g.sections.length > 0);
  const activeGroup =
    nav.find((g) => g.sections.some((s) => sectionPath(s.slug) === pathname)) || nav[0];
  const activeSection =
    activeGroup?.sections.find((s) => sectionPath(s.slug) === pathname) || activeGroup?.sections[0];

  const canContribute = isAdmin || !!contributorToken;
  const showRequestAccess = accessChecked && !canContribute && activeSection;

  return (
    <header ref={barRef} className={styles.bar}>
      <div className={styles.topRow}>
        <Link href={sectionPath(nav[0]?.sections[0]?.slug || "")} className={styles.brand}>
          {trip.name}
        </Link>

        <div className={styles.actions}>
          {isAdmin ? (
            <>
              <Link href="/" className={styles.actionLink}>
                All trips
              </Link>
              <Link href={`/${trip.slug}/admin/sections`} className={styles.manageLink}>
                Manage
              </Link>
            </>
          ) : (
            showRequestAccess && <RequestAccess trip={trip} section={activeSection!} contactEmail={contactEmail} />
          )}
        </div>
      </div>

      {nav.length > 0 && (
        <>
          <div className={styles.navRow}>
            <NavigationMenu className={styles.menuDesktop} aria-label="Trip categories">
              <NavigationMenuList>
                {nav.map((g) => (
                  <NavigationMenuItem key={g.id}>
                    <NavigationMenuLink asChild active={g.id === activeGroup?.id}>
                      <Link href={sectionPath(g.sections[0].slug)}>{g.label}</Link>
                    </NavigationMenuLink>
                  </NavigationMenuItem>
                ))}
              </NavigationMenuList>
            </NavigationMenu>

            <div className={styles.menuMobile}>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" aria-label="Sections menu" className={styles.hamburgerButton}>
                    <MenuIcon />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  {nav.map((g) => (
                    <div key={g.id}>
                      <DropdownMenuLabel>{g.label}</DropdownMenuLabel>
                      {g.sections.map((s) => (
                        <DropdownMenuItem key={s.id} asChild>
                          <Link href={sectionPath(s.slug)}>{s.sub_nav_label || s.label}</Link>
                        </DropdownMenuItem>
                      ))}
                    </div>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* The active group's own sections (e.g. Possible/Previous) on
              the left — appears once you're actually on one of them,
              defaulting to the first (normally "Possible ..."), hidden
              on the mobile hamburger view since that already lists
              these nested under their group — plus a slot on the right
              that SectionPage portals its filter/sort controls into
              (see NavSlot), so they visually live in this bar instead
              of their own separate row. Always rendered (even with a
              single-section group) so that slot always has a home. */}
          {activeGroup && (
            <div className={styles.subNavRow}>
              {activeGroup.sections.length > 1 && (
                <NavigationMenu className={styles.subNavMenu} aria-label={`${activeGroup.label} sections`}>
                  <NavigationMenuList>
                    {activeGroup.sections.map((s) => (
                      <NavigationMenuItem key={s.id}>
                        <NavigationMenuLink asChild size="sm" active={pathname === sectionPath(s.slug)}>
                          <Link href={sectionPath(s.slug)}>{s.sub_nav_label || s.label}</Link>
                        </NavigationMenuLink>
                      </NavigationMenuItem>
                    ))}
                  </NavigationMenuList>
                </NavigationMenu>
              )}
              <div ref={(el) => navSlot?.setSlot(el)} className={styles.navSlotTarget} />
            </div>
          )}
        </>
      )}
    </header>
  );
}
