"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NavigationMenu, NavigationMenuList, NavigationMenuItem, NavigationMenuLink } from "@/components/NavigationMenu";
import Button from "@/components/Button";
import RequestAccess from "@/components/RequestAccess";
import CreateLoginPrompt from "@/components/CreateLoginPrompt";
import LoginPrompt from "@/components/LoginPrompt";
import LogoutButton from "@/components/LogoutButton";
import SiteHeader, { siteHeaderStyles } from "@/components/SiteHeader";
import MobileNavDrawer from "./MobileNavDrawer";
import TripSubNav from "./TripSubNav";
import { captureInviteToken, hasSeenCreateLoginNudge, markCreateLoginNudgeSeen, clearInviteAccess } from "@/lib/inviteClient";
import { useOptimisticPath } from "@/lib/useOptimisticPath";
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
// GROUPS/COLLECTIONS constants. Full width: trip name + utility links
// on their own (non-sticky — you don't need it pinned while reading
// down a list) row, then every top-level group (Houses, Food & Drink,
// Activities, ...) as a plain flat link alongside this section's own
// actions (Add/Google Sheet/Sort/filter — see NavSlot) on the row
// below — no dropdown/flyout — and that row (plus sub-nav once you're
// on a section) is what's actually sticky (see .sticky-nav). Landing
// on a group navigates straight to its first (normally "Possible ...")
// section; once you're on any section in that group, a third row
// appears underneath with that group's own sections (Possible/
// Previous), so there's always at most one extra row, never a hover-
// menu. Collapses to a single hamburger below 1024px, where the flat
// row doesn't reliably fit — opens a full-screen drawer
// (MobileNavDrawer) listing every group/section plus this section's
// Sheet/Sort/Filter actions; only +Add stays in the sticky header next
// to the hamburger. Utility links are
// gated on who's actually looking: an admin session gets the "All
// Trips ›" breadcrumb prefix (see .brand) and a "Manage" button, a
// visitor with neither that nor an invite link gets "Request access",
// and a contributor (has an invite link, isn't the
// owner) gets neither — they already have what they need on the page.
export default function TripNavHeader({
  trip,
  nav: allNav,
  isAdmin = false,
  isEditor = false,
  contactEmail = null,
}: TripNavHeaderProps) {
  const pathname = usePathname(); // real URL for sticky-nav height / admin checks
  const { path, go, prefetch } = useOptimisticPath();
  const barRef = useRef<HTMLDivElement>(null);
  const navSlot = useNavSlot();
  const [contributorToken, setContributorToken] = useState<string | null>(null);
  const [accessChecked, setAccessChecked] = useState(isAdmin);
  const [drawerOpen, setDrawerOpen] = useState(false);
  // Seeds CreateLoginPrompt's own defaultOpen — see the effect below.
  const [showCreateLoginNudge, setShowCreateLoginNudge] = useState(false);
  // Nested under the nav group's own slug now — /{tripSlug}/{navGroupSlug}/
  // {sectionSlug} — since a section's slug is only unique within its own
  // group (see migration 0014), not trip-wide.
  const sectionPath = (navGroupSlug: string, sectionSlug: string) => `/${trip.slug}/${navGroupSlug}/${sectionSlug}`;
  const itineraryPath = `/${trip.slug}/itinerary`;

  useEffect(() => {
    const token = captureInviteToken(trip.slug);
    // Permanent session replaces invite access — drop any leftover
    // token so Logout can't fall back to browser-cookie editing.
    if ((isAdmin || isEditor) && token) {
      clearInviteAccess(trip.slug);
      setContributorToken(null);
      setAccessChecked(true);
      setShowCreateLoginNudge(false);
      return;
    }
    setContributorToken(token);
    setAccessChecked(true);
    // Surface the "you can make this permanent" offer up front on a
    // contributor's first real visit, rather than leaving it as a
    // small link they'd only find by noticing it (confirmed live: they
    // didn't) — shown at most once per browser per trip; the link
    // itself stays available afterward either way.
    if (token && !isAdmin && !isEditor && !hasSeenCreateLoginNudge(trip.slug)) {
      setShowCreateLoginNudge(true);
      markCreateLoginNudgeSeen(trip.slug);
    } else {
      // Clear stale true from an earlier visit in this same React tree —
      // otherwise become-editor → logout remounts CreateLoginPrompt with
      // defaultOpen still true and the modal pops open again.
      setShowCreateLoginNudge(false);
    }
  }, [trip.slug, isAdmin, isEditor]);

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

  // The *sticky* portion's own rendered height (.sticky-nav — nav-row
  // plus sub-nav-row when present, not .top-row above it, which
  // scrolls away normally) — published as a CSS variable on the
  // document root so anything sticky further down the tree
  // (SectionPage's filter/sort bar, which isn't a DOM sibling of this
  // component) can stick right below it instead of guessing a fixed
  // offset. Recalculated on resize since it can wrap taller at
  // narrower widths; 0 whenever .sticky-nav doesn't render at all
  // (admin routes, or a trip with no nav yet) since barRef.current is
  // then null and nothing here runs.
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
  // Optimistic `path` for active pills; real pathname for admin route checks.
  const isItineraryRoute = path === itineraryPath || path.startsWith(`${itineraryPath}/`);
  const matchedGroup = nav.find((g) =>
    g.sections.some((s) => sectionPath(g.slug, s.slug) === path),
  );
  // Highlight only the group for the current section URL — never on Itinerary.
  const activeGroup = isItineraryRoute ? undefined : matchedGroup || nav[0];
  // Section sub-nav (Possible/Visited) only on section pages — Itinerary
  // is a peer tab with no nested sections, so no second row there.
  const subNavGroup = isItineraryRoute ? undefined : matchedGroup || nav[0];
  const activeSection =
    matchedGroup?.sections.find((s) => sectionPath(matchedGroup.slug, s.slug) === path) ||
    matchedGroup?.sections[0];

  const canContribute = isAdmin || isEditor || !!contributorToken;
  const showRequestAccess = accessChecked && !canContribute && activeSection;
  // Offered only to someone recognized purely by this browser's own
  // invite token — an editor already has the permanent version of
  // this, and there's nothing to upgrade for an admin.
  const showCreateLogin = accessChecked && !isAdmin && !isEditor && !!contributorToken;
  // The admin section (Sections/Invites/Trip Settings — its own nested
  // layout.tsx) has its own nav entirely; this bar's own category tabs
  // and sub-nav/actions row underneath just duplicate it pointlessly
  // there (confirmed live: two full navigation bars stacked on top of
  // each other). The top row (breadcrumb, Manage) still makes sense
  // everywhere, so only the block below this is skipped.
  const isAdminRoute = pathname.startsWith(`/${trip.slug}/admin`);

  return (
    <>
      <SiteHeader
        brand={
          <>
            {/* "Home ›" for admins (site stack lives on /); "All Trips ›"
                for editors and invite contributors who only see trips. */}
            {(isAdmin || isEditor || !!contributorToken) && (
              <>
                <Link href="/" className={siteHeaderStyles["brand-crumb"]}>
                  {isAdmin ? "Home" : "All Trips"}
                </Link>
                <span className={siteHeaderStyles["brand-separator"]} aria-hidden>
                  ›
                </span>
              </>
            )}
            <Link
              href={nav[0] ? sectionPath(nav[0].slug, nav[0].sections[0].slug) : `/${trip.slug}`}
              className={siteHeaderStyles["brand-crumb"]}
            >
              {trip.name}
            </Link>
          </>
        }
        actions={
          isAdmin ? (
            <>
              {/* This row's own set of buttons stays fixed regardless of
                  trip state — a conditional third item here (an earlier
                  version put Archive Unvisited in this same row) made
                  the header's structure shift between a completed trip
                  and every other one. It lives on the Trip Settings
                  page instead now, right by the Completed checkbox that
                  gates it (see TripSettingsPage). */}
              <Button variant="secondary" size="sm" asChild>
                <Link href={`/${trip.slug}/admin/sections`}>Manage</Link>
              </Button>
              {/* /admin routes need real access to render anything
                  useful — redirect back to the public trip page rather
                  than stranding a just-logged-out admin on one. */}
              <LogoutButton redirectTo={isAdminRoute ? `/${trip.slug}` : undefined} />
            </>
          ) : isEditor ? (
            <LogoutButton />
          ) : (
            accessChecked && (
              <>
                {!!contributorToken ? (
                  <div className={siteHeaderStyles["invite-access"]}>
                    <div className={siteHeaderStyles["invite-access-links"]}>
                      <LoginPrompt
                        hasInviteAccess
                        contributorToken={contributorToken}
                        tripSlug={trip.slug}
                      />
                      {showCreateLogin && (
                        <CreateLoginPrompt
                          trip={trip}
                          contributorToken={contributorToken!}
                          defaultOpen={showCreateLoginNudge}
                        />
                      )}
                    </div>
                    <p className={siteHeaderStyles["invite-access-hint"]}>(current access via browser cookie)</p>
                  </div>
                ) : (
                  <>
                    <LoginPrompt />
                    {showRequestAccess && (
                      <RequestAccess
                        trip={trip}
                        section={activeSection!}
                        contactEmail={contactEmail}
                        triggerClassName={siteHeaderStyles["request-access-trigger"]}
                      />
                    )}
                  </>
                )}
              </>
            )
          )
        }
      />

      {nav.length > 0 && !isAdminRoute && (
        <div ref={barRef} className={styles["sticky-nav"]}>
          <div className={styles["nav-row"]}>
            <NavigationMenu className={styles["menu-desktop"]} aria-label="Trip categories">
              <NavigationMenuList>
                {nav.map((g) => {
                  const href = sectionPath(g.slug, g.sections[0].slug);
                  return (
                    <NavigationMenuItem key={g.id}>
                      <NavigationMenuLink asChild active={g.id === activeGroup?.id}>
                        <Link
                          href={href}
                          onPointerEnter={() => prefetch(href)}
                          onClick={() => go(href)}
                        >
                          {g.label}
                        </Link>
                      </NavigationMenuLink>
                    </NavigationMenuItem>
                  );
                })}
                {/* A fixed built-in page, not part of the nav_groups/
                    sections data model Section Designer manages — a
                    peer to the category tabs, not nested under one.
                    Hidden entirely (not just disabled) unless isAdmin —
                    not yet opened up to trip editors/contributors the
                    way the rest of a trip's content is. */}
                {isAdmin && (
                  <NavigationMenuItem>
                    <NavigationMenuLink asChild active={isItineraryRoute}>
                      <Link
                        href={itineraryPath}
                        onPointerEnter={() => prefetch(itineraryPath)}
                        onClick={() => go(itineraryPath)}
                      >
                        Itinerary
                      </Link>
                    </NavigationMenuLink>
                  </NavigationMenuItem>
                )}
              </NavigationMenuList>
            </NavigationMenu>

            <div className={styles["menu-mobile"]}>
              <MobileNavDrawer
                nav={nav}
                pathname={path}
                sectionPath={sectionPath}
                extraLink={isAdmin ? { href: itineraryPath, label: "Itinerary" } : undefined}
                open={drawerOpen}
                onOpenChange={setDrawerOpen}
                onActionsSlotChange={navSlot?.setMobileActionsSlot}
                onNavigate={go}
              />
            </div>

            {/* +Add always lives here; Sheet/Sort/Filter sit beside it
                from 1024px up (UtilityControls) and portal into the
                burger drawer below that. Always mounted so the slot
                has a stable home the moment SectionPage's controls
                appear. Collapses to zero when empty via :has()/:empty. */}
            <div ref={(el) => navSlot?.setSlot(el)} className={styles["nav-slot-target"]} />
          </div>

          {/* Section sub-nav only — omitted on Itinerary (peer tab, no nested sections). */}
          {subNavGroup ? (
            <TripSubNav
              group={subNavGroup}
              path={path}
              tripSlug={trip.slug}
              go={go}
              prefetch={prefetch}
            />
          ) : null}
        </div>
      )}
    </>
  );
}
