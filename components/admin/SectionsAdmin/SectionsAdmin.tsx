"use client";

import { useEffect, useState } from "react";
import classNames from "classnames";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SECTION_TEMPLATES, type SectionTemplate } from "@/lib/sectionTemplates";
import type { CustomSectionTemplate } from "@/lib/customSectionTemplates";
import { PRIMARY_TIER_SORT_ORDER, PAST_TIER_SORT_ORDER } from "@/lib/sectionLabels";
import type { PublicTrip, NavGroup, Section } from "@/lib/types";
import styles from "./SectionsAdmin.module.css";

export interface SectionsAdminProps {
  trip: PublicTrip;
  nav: NavGroup[];
}

function GripIcon() {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="currentColor">
      <circle cx="9" cy="6" r="1.5" />
      <circle cx="15" cy="6" r="1.5" />
      <circle cx="9" cy="12" r="1.5" />
      <circle cx="15" cy="12" r="1.5" />
      <circle cx="9" cy="18" r="1.5" />
      <circle cx="15" cy="18" r="1.5" />
    </svg>
  );
}

export default function SectionsAdmin({ trip, nav: initialNav }: SectionsAdminProps) {
  const router = useRouter();
  const [nav, setNav] = useState(initialNav);
  const [error, setError] = useState("");
  const [addingTemplate, setAddingTemplate] = useState<string | null>(null);
  const [customTemplates, setCustomTemplates] = useState<CustomSectionTemplate[]>([]);
  // Native HTML5 drag and drop, id of whichever nav group is currently
  // being dragged. Only whole groups are draggable — see reorderGroups
  // below for why sections themselves aren't independently reorderable.
  const [draggingGroupId, setDraggingGroupId] = useState<string | null>(null);

  const apiBase = `/api/trips/${trip.slug}/sections`;
  const existingGroupLabels = new Set(nav.map((g) => g.label));

  // Every custom nav group any trip has ever built — see
  // lib/customSectionTemplates.ts. Not trip-scoped, so this loads once
  // regardless of which trip's admin page it's rendered on.
  useEffect(() => {
    fetch("/api/section-templates", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => setCustomTemplates(data.templates || []))
      .catch(() => {});
  }, []);

  async function refresh() {
    const res = await fetch(apiBase, { cache: "no-store" });
    const data = await res.json();
    if (res.ok) setNav(data.nav);
    // TripNavHeader lives in this trip's own layout.tsx, a server
    // component Next.js otherwise keeps cached across client-side
    // navigation — without this, clicking "Back to <trip>" (or any
    // other nav to a page under it) can serve a stale nav built before
    // this section existed, showing a blank/broken-looking bar until a
    // hard refresh. Cheap to always call, even when nothing changed.
    router.refresh();
  }

  async function toggleEnabled(section: Section, navGroupSlug: string, enabled: boolean) {
    setError("");
    try {
      const res = await fetch(`${apiBase}/${navGroupSlug}/${section.slug}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Update failed");
      refresh();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  // Only whole nav groups (the Stays/Food & Drink/Activities/... tabs)
  // are drag-reorderable — not the individual sections inside one.
  // A group's sections keep the relative order they were created with
  // (Options before Past/Visited, per lib/sectionLabels.ts's
  // PRIMARY_TIER_SORT_ORDER/PAST_TIER_SORT_ORDER) and move together as
  // that one atomic unit; there's no drag interaction that could flip
  // just the two of them relative to each other, because there's no
  // drag interaction on a single section at all anymore. (An earlier
  // version let sections drag independently with a same-tier-only
  // guard, but the whole group's own drag area overlapping every
  // section card's own drag area made drops unreliable — simpler and
  // more correct to make the group the only draggable unit.)
  async function reorderGroups(draggedId: string, targetId: string) {
    if (draggedId === targetId) return;
    const ids = nav.map((g) => g.id);
    const fromIndex = ids.indexOf(draggedId);
    const toIndex = ids.indexOf(targetId);
    if (fromIndex === -1 || toIndex === -1) return;

    const reordered = [...nav];
    const [moved] = reordered.splice(fromIndex, 1);
    reordered.splice(toIndex, 0, moved);
    setNav(reordered);

    setError("");
    try {
      await Promise.all(
        reordered.map((g, i) =>
          fetch(`/api/trips/${trip.slug}/nav-groups/${g.slug}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sortOrder: i }),
          })
        )
      );
    } catch (err) {
      setError((err as Error).message);
    } finally {
      refresh();
    }
  }

  async function addTemplate(template: SectionTemplate) {
    setError("");
    setAddingTemplate(template.key);
    // A brand new trip has nothing to look at yet — once its first
    // section actually exists, jump straight to it instead of leaving
    // the admin on this template-picker page needing a manual "Back to
    // <trip>" click. A trip that already has sections stays here after
    // adding another (matches deliberately setting up several in one
    // sitting rather than adding one at a time).
    const isFirstSection = nav.every((g) => g.sections.length === 0);
    // Houses get one full-width card per row (a lot to show: photos,
    // price, bed/bath counts, a map); Food & Drink and Activities read
    // better in the tighter 3-across compact grid — both tiers of a
    // category share this.
    const cardLayout: Section["card_layout"] = template.key !== "houses" ? "grid-3" : "list";
    // Pairing (2-item options) and the full comparison map (pins/
    // legend/reference points, vs. just a plain marker) only make sense
    // for a still-deciding house-options list — Food & Drink/Activities
    // never want either, and a "previous" list has nothing left to
    // decide either way.
    const isHouses = template.key === "houses";
    try {
      // A completed trip (see TripSettingsForm — set at creation via
      // NewTripForm's "documenting a past trip" checkbox, or toggled on
      // later) has nothing left to decide: everything in it already
      // happened. One plain section instead of the Possible/Previously
      // pair, named for the category itself rather than "Options"/
      // "Previously ..." wording that only makes sense when something's
      // still being weighed — and with no ratings/pairing, its entries
      // auto-mark Visited on add (see the entries POST route).
      if (trip.completed) {
        const res = await fetch(apiBase, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            slug: template.previous.slug,
            label: template.navGroupLabel,
            addPlaceholder: "Paste a link...",
            emptyMessage: "Nothing here yet — paste a link above.",
            supportsPairing: false,
            hasMap: false,
            supportsRatings: false,
            cardLayout,
            newNavGroupLabel: template.navGroupLabel,
            fieldDefs: template.fieldDefs,
            skipTemplateCapture: true,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to create section");
        if (isFirstSection) {
          router.push(`/${trip.slug}`);
          router.refresh();
        } else {
          refresh();
        }
        return;
      }

      const possibleRes = await fetch(apiBase, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: template.possible.slug,
          label: template.possible.label,
          addPlaceholder: template.possible.addPlaceholder,
          emptyMessage: template.possible.emptyMessage,
          supportsPairing: isHouses,
          hasMap: isHouses,
          supportsRatings: isHouses,
          cardLayout,
          newNavGroupLabel: template.navGroupLabel,
          fieldDefs: template.fieldDefs,
          skipTemplateCapture: true,
          sortOrder: PRIMARY_TIER_SORT_ORDER,
        }),
      });
      const possibleData = await possibleRes.json();
      if (!possibleRes.ok) throw new Error(possibleData.error || "Failed to create section");

      const previousRes = await fetch(apiBase, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: template.previous.slug,
          label: template.previous.label,
          addPlaceholder: template.previous.addPlaceholder,
          emptyMessage: template.previous.emptyMessage,
          // Pairing is specifically for a still-deciding Possible Houses
          // list — a "previous" list (already decided) doesn't need it,
          // any more than it needs driving-times/map.
          supportsPairing: false,
          hasMap: false,
          supportsRatings: false,
          cardLayout,
          navGroupId: possibleData.section.nav_group_id,
          fieldDefs: template.fieldDefs,
          skipTemplateCapture: true,
          sortOrder: PAST_TIER_SORT_ORDER,
        }),
      });
      const previousData = await previousRes.json();
      if (!previousRes.ok) {
        throw new Error(
          `Created "${template.possible.label}", but "${template.previous.label}" failed: ${previousData.error || "unknown error"}`
        );
      }

      if (isFirstSection) {
        router.push(`/${trip.slug}`);
        router.refresh();
      } else {
        refresh();
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setAddingTemplate(null);
    }
  }

  // Recreates a custom template's whole nav group — one, two, or
  // however many sections it was captured with (see
  // lib/customSectionTemplates.ts) — in the same one-nav-group-per-call
  // shape the built-in templates use above: the first section names the
  // new nav group, every one after reuses the id that came back. A
  // single-section template that needs a Previously Visited counterpart
  // too gets one the normal way afterward — "+ New section" (which
  // already has its own "add a counterpart" option), or by adding one
  // by hand and using its own Edit page's Prefill panel to populate it
  // from wherever this template's own history actually lives (see
  // SectionForm's PrefillPanel) — not decided blindly here up front.
  async function addCustomTemplate(template: CustomSectionTemplate) {
    setError("");
    setAddingTemplate(template.template_key);
    const isFirstSection = nav.every((g) => g.sections.length === 0);
    try {
      let navGroupId: string | undefined;
      // Array order is intentional (the primary section is always
      // captured first — see lib/customSectionTemplates.ts) — index
      // doubles as a real sort_order instead of leaving every section
      // tied at the route's own bare default, which is exactly what
      // let real trips' display order come out inconsistent/reversed.
      for (const [i, s] of template.sections.entries()) {
        const res = await fetch(apiBase, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            slug: s.slug,
            label: s.label,
            subNavLabel: s.subNavLabel,
            addPlaceholder: s.addPlaceholder,
            emptyMessage: s.emptyMessage,
            supportsPairing: s.supportsPairing,
            hasMap: s.hasMap,
            supportsRatings: s.supportsRatings,
            cardLayout: s.cardLayout,
            fieldDefs: s.fieldDefs,
            skipTemplateCapture: true,
            sortOrder: i,
            ...(navGroupId ? { navGroupId } : { newNavGroupLabel: template.nav_group_label }),
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || `Failed to create "${s.label}"`);
        if (!navGroupId) navGroupId = data.section.nav_group_id;
      }

      if (isFirstSection) {
        router.push(`/${trip.slug}`);
        router.refresh();
      } else {
        refresh();
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setAddingTemplate(null);
    }
  }

  return (
    <div className={styles["root"]}>
      <div className={styles["header"]}>
        <h1 className={styles["title"]}>Sections</h1>
        <Link href={`/${trip.slug}/admin/sections/new`} className={styles["new-section-button"]}>
          + New section
        </Link>
      </div>

      {error && <p className={styles["error"]}>{error}</p>}

      <div className={styles["templates-section"]}>
        <h2 className={styles["section-heading"]}>Add from a template</h2>
        <p className={styles["templates-hint"]}>
          {trip.completed
            ? "Trip is Completed, so each template creates one plain section — new entries come in already checked off Visited."
            : 'Each creates an "Options" / "Before" pair — fully editable afterward.'}
        </p>
        <div className={styles["template-subheading"]}>Defaults</div>
        <div className={styles["template-list"]}>
          {SECTION_TEMPLATES.map((t) => {
            const exists = existingGroupLabels.has(t.navGroupLabel);
            return (
              <button
                key={t.key}
                type="button"
                disabled={exists || addingTemplate === t.key}
                onClick={() => addTemplate(t)}
                className={styles["template-button"]}
                title={exists ? `${t.navGroupLabel} already exists` : undefined}
              >
                {addingTemplate === t.key ? "Adding..." : exists ? `${t.navGroupLabel} ✓` : `+ ${t.navGroupLabel}`}
              </button>
            );
          })}
        </div>

        {customTemplates.length > 0 && (
          <>
            <div className={styles["template-subheading"]}>
              Custom sections{" "}
              <span className={styles["template-subheading-hint"]}>— built on another trip, reusable here</span>
            </div>
            <div className={styles["template-list"]}>
              {customTemplates.map((t) => {
                const exists = existingGroupLabels.has(t.nav_group_label);
                return (
                  <button
                    key={t.template_key}
                    type="button"
                    disabled={exists || addingTemplate === t.template_key}
                    onClick={() => addCustomTemplate(t)}
                    className={styles["template-button"]}
                    title={exists ? `${t.nav_group_label} already exists` : undefined}
                  >
                    {addingTemplate === t.template_key
                      ? "Adding..."
                      : exists
                        ? `${t.nav_group_label} ✓`
                        : `+ ${t.nav_group_label}`}
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>

      {nav.every((g) => g.sections.length === 0) && (
        <p className={styles["empty-hint"]}>No sections yet — add one from a template above, or create a custom one.</p>
      )}

      {nav.map(
        (group) =>
          group.sections.length > 0 && (
            <div
              key={group.id}
              draggable
              onDragStart={(e) => {
                // Firefox refuses to start a drag at all without this —
                // Chrome/Safari don't strictly need it, but setting it
                // (and effectAllowed below) is what makes this reliable
                // across all three rather than "seems to work in Chrome".
                e.dataTransfer.setData("text/plain", group.id);
                e.dataTransfer.effectAllowed = "move";
                setDraggingGroupId(group.id);
              }}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
              }}
              onDrop={(e) => {
                e.preventDefault();
                if (draggingGroupId) reorderGroups(draggingGroupId, group.id);
                setDraggingGroupId(null);
              }}
              onDragEnd={() => setDraggingGroupId(null)}
              className={classNames(styles["group-section"], draggingGroupId === group.id && styles["dragging"])}
            >
              <h2 className={styles["section-heading"]}>
                <span className={styles["drag-handle"]} aria-hidden="true">
                  <GripIcon />
                </span>
                {group.label}
              </h2>
              <div className={styles["section-list"]}>
                {group.sections.map((section) => (
                  // Not independently draggable — see reorderGroups above.
                  // This card sits inside the group's own draggable area,
                  // so grabbing it anywhere still drags the whole group.
                  <div
                    key={section.id}
                    className={section.enabled ? styles["section-card"] : styles["section-card-disabled"]}
                  >
                    <div className={styles["section-label-row"]}>
                      <div>
                        <div className={styles["section-label"]}>{section.label}</div>
                        <div className={styles["section-meta"]}>
                          /{trip.slug}/{group.slug}/{section.slug}
                          {!section.enabled && " · disabled"}
                        </div>
                      </div>
                    </div>
                    <div className={styles["section-actions"]}>
                      <label className={styles["enabled-checkbox-label"]}>
                        <input
                          type="checkbox"
                          checked={section.enabled}
                          onChange={(e) => toggleEnabled(section, group.slug, e.target.checked)}
                          className={styles["enabled-checkbox"]}
                        />
                        Enabled
                      </label>
                      <Link
                        href={`/${trip.slug}/admin/sections/${group.slug}/${section.slug}/edit`}
                        className={styles["edit-link"]}
                      >
                        Edit
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
      )}
    </div>
  );
}
