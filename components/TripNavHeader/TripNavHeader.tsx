"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NavigationMenu, NavigationMenuList, NavigationMenuItem, NavigationMenuLink } from "@/components/NavigationMenu";
import Button from "@/components/Button";
import RequestAccess from "@/components/RequestAccess";
import CreateLoginPrompt from "@/components/CreateLoginPrompt";
import MobileNavDrawer from "./components/MobileNavDrawer";
import { captureInviteToken } from "@/lib/inviteClient";
import { useNavSlot } from "./NavSlot";
import type { PublicTrip, NavGroup } from "@/lib/types";
import styles from "./TripNavHeader.module.css";

export interface TripNavHeaderProps {
  trip: PublicTrip;
  nav: NavGroup[];
  isAdmin?: boolean;
  /** A real, permanent login already linked to this trip (see
   * supabase/migrations/0021_trip_editors.sql) — someone who already
   * has this doesn't need the "create a permanent login" offer below. */
  isEditor?: boolean;
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
// hamburger below 1024px, where the flat row doesn't reliably fit —
// opens a full-screen drawer (MobileNavDrawer) listing every group/
// section plus this section's own action row, rather than a small
// anchored popover. Utility links are
// gated on who's actually looking: an admin session gets "All trips"/
// "Manage", a visitor with neither that nor an invite link gets
// "Request access", and a contributor (has an invite link, isn't the
// owner) gets neither — they already have what they need on the page.
export default function TripNavHeader({
  trip,
  nav: allNav,
  isAdmin = false,
  isEditor = false,
  contactEmail = null,
}: TripNavHeaderProps) {
  const pathname = usePathname();
  const barRef = useRef<HTMLElement>(null);
  const navSlot = useNavSlot();
  const [contributorToken, setContributorToken] = useState<string | null>(null);
  const [accessChecked, setAccessChecked] = useState(isAdmin);
  // While the mobile drawer is open, it takes over the NavSlot target
  // (see the sub-nav-row's own `!drawerOpen` guard below and
  // MobileNavDrawer itself) — so this section's Add/Sheet/Sort actions
  // relocate in there together with the nav links, instead of a
  // separate always-on toolbar row plus a nav-only popover competing
  // for the same narrow header.
  const [drawerOpen, setDrawerOpen] = useState(false);
  // Nested under the nav group's own slug now — /{tripSlug}/{navGroupSlug}/
  // {sectionSlug} — since a section's slug is only unique within its own
  // group (see migration 0014), not trip-wide.
  const sectionPath = (navGroupSlug: string, sectionSlug: string) => `/${trip.slug}/${navGroupSlug}/${sectionSlug}`;

  useEffect(() => {
    setContributorToken(captureInviteToken(trip.slug));
    setAccessChecked(true);
  }, [trip.slug]);

  // The hamburger trigger itself is CSS-hidden past 1024px (.menu-mobile
  // below), but resizing past that threshold WHILE the drawer is
  // already open doesn't touch React state on its own — confirmed live
  // as a full-screen overlay stuck open over what's now a desktop-width
  // page with no way to have opened it from here. Same 1024px
  // breakpoint as everywhere else in this file; only listens while
  // there's actually something to close.
  useEffect(() => {
    if (!drawerOpen) return;
    const mq = window.matchMedia("(min-width: 1024px)");
    const handleChange = (e: MediaQueryListEvent) => {
      if (e.matches) setDrawerOpen(false);
    };
    mq.addEventListener("change", handleChange);
    return () => mq.removeEventListener("change", handleChange);
  }, [drawerOpen]);

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
    nav.find((g) => g.sections.some((s) => sectionPath(g.slug, s.slug) === pathname)) || nav[0];
  const activeSection =
    activeGroup?.sections.find((s) => sectionPath(activeGroup.slug, s.slug) === pathname) || activeGroup?.sections[0];

  const canContribute = isAdmin || isEditor || !!contributorToken;
  const showRequestAccess = accessChecked && !canContribute && activeSection;
  // Offered only to someone recognized purely by this browser's own
  // invite token — an editor already has the permanent version of
  // this, and there's nothing to upgrade for an admin.
  const showCreateLogin = accessChecked && !isAdmin && !isEditor && !!contributorToken;

  return (
    <header ref={barRef} className={styles["root"]}>
      <div className={styles["top-row"]}>
        <Link
          href={nav[0] ? sectionPath(nav[0].slug, nav[0].sections[0].slug) : `/${trip.slug}`}
          className={styles["brand"]}
        >
          {trip.name}
        </Link>

        <div className={styles["actions"]}>
          {isAdmin ? (
            <>
              <Link href="/" className={styles["action-link"]}>
                All trips
              </Link>
              {/* This row's own set of buttons stays fixed regardless of
                  trip state — a conditional third item here (an earlier
                  version put Archive Unvisited in this same row) made
                  the header's structure shift between a completed trip
                  and every other one. It lives on the Trip Settings
                  page instead now, right by the Completed checkbox that
                  gates it (see TripSettingsPage). */}
              <Link href={`/${trip.slug}/admin/sections`} className={styles["manage-link"]}>
                Manage
              </Link>
            </>
          ) : showCreateLogin ? (
            <CreateLoginPrompt trip={trip} contributorToken={contributorToken!} />
          ) : (
            showRequestAccess && (
              <RequestAccess
                trip={trip}
                section={activeSection!}
                contactEmail={contactEmail}
                triggerClassName={styles["request-access-trigger"]}
              />
            )
          )}
        </div>
      </div>

      {nav.length > 0 && (
        <>
          <div className={styles["nav-row"]}>
            <NavigationMenu className={styles["menu-desktop"]} aria-label="Trip categories">
              <NavigationMenuList>
                {nav.map((g) => (
                  <NavigationMenuItem key={g.id}>
                    <NavigationMenuLink asChild active={g.id === activeGroup?.id}>
                      <Link href={sectionPath(g.slug, g.sections[0].slug)}>{g.label}</Link>
                    </NavigationMenuLink>
                  </NavigationMenuItem>
                ))}
              </NavigationMenuList>
            </NavigationMenu>

            <div className={styles["menu-mobile"]}>
              <MobileNavDrawer
                nav={nav}
                activeGroupId={activeGroup?.id}
                pathname={pathname}
                sectionPath={sectionPath}
                open={drawerOpen}
                onOpenChange={setDrawerOpen}
              />
            </div>
          </div>

          {/* The active group's own sections (e.g. Possible/Previous) on
              the left — appears once you're actually on one of them,
              defaulting to the first (normally "Possible ..."), hidden
              on the mobile hamburger view since that already lists
              these nested under their group — plus a slot on the right
              that SectionPage portals its filter/sort controls into
              (see NavSlot), so they visually live in this bar instead
              of their own separate row. Always mounted, even with a
              single-section group and nothing to portal in, so the
              slot always has a stable home the moment either shows up.
              Collapses to zero visible size on its own (a pure CSS
              :has() rule below) rather than an empty gray bar whenever
              there's genuinely nothing to show — no JS/context needed:
              a portal's content is real DOM the browser's own :has()
              matching reacts to directly the moment it's added,
              without the SSR/hydration-timing mismatch a React-state
              version of this would have (the portal target is always
              empty during server rendering no matter what will
              eventually render into it once hydrated).

              The target itself is skipped entirely while the mobile
              drawer is open — MobileNavDrawer mounts its own copy then,
              taking over the same NavSlot ref (see useNavSlot), so
              SectionPage's portal just follows it there and back
              without either side needing to know the other exists. */}
          {activeGroup && (
            <div className={styles["sub-nav-row"]}>
              {activeGroup.sections.length > 1 && (
                <NavigationMenu className={styles["sub-nav-menu"]} aria-label={`${activeGroup.label} sections`}>
                  <NavigationMenuList>
                    {activeGroup.sections.map((s) => (
                      <NavigationMenuItem key={s.id}>
                        <NavigationMenuLink asChild size="sm" active={pathname === sectionPath(activeGroup.slug, s.slug)}>
                          <Link href={sectionPath(activeGroup.slug, s.slug)}>{s.sub_nav_label || s.label}</Link>
                        </NavigationMenuLink>
                      </NavigationMenuItem>
                    ))}
                  </NavigationMenuList>
                </NavigationMenu>
              )}
              {!drawerOpen && <div ref={(el) => navSlot?.setSlot(el)} className={styles["nav-slot-target"]} />}
            </div>
          )}
        </>
      )}
    </header>
  );
}
