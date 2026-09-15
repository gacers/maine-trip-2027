"use client";

import { useState } from "react";
import Link from "next/link";
import { SECTION_TEMPLATES, type SectionTemplate } from "@/lib/sectionTemplates";
import type { PublicTrip, NavGroup, Section } from "@/lib/types";
import styles from "./SectionsAdmin.module.css";

export interface SectionsAdminProps {
  trip: PublicTrip;
  nav: NavGroup[];
}

export default function SectionsAdmin({ trip, nav: initialNav }: SectionsAdminProps) {
  const [nav, setNav] = useState(initialNav);
  const [error, setError] = useState("");
  const [addingTemplate, setAddingTemplate] = useState<string | null>(null);

  const apiBase = `/api/trips/${trip.slug}/sections`;
  const existingGroupLabels = new Set(nav.map((g) => g.label));

  async function refresh() {
    const res = await fetch(apiBase, { cache: "no-store" });
    const data = await res.json();
    if (res.ok) setNav(data.nav);
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

  async function addTemplate(template: SectionTemplate) {
    setError("");
    setAddingTemplate(template.key);
    // Houses get one full-width card per row (a lot to show: photos,
    // price, bed/bath counts, a map); Food & Drink and Activities read
    // better in the tighter 3-across compact grid — both tiers of a
    // category share this.
    const cardLayout: Section["card_layout"] = template.key !== "houses" ? "grid-3" : "list";
    // Pairing (2-item options), manual ranking, and the full comparison
    // map (pins/legend/reference points, vs. just a plain marker) only
    // make sense for a still-deciding house-options list — Food & Drink/
    // Activities never want any of them, and a "previous" list has
    // nothing left to decide either way.
    const isHouses = template.key === "houses";
    try {
      // A completed trip (see TripSettingsForm — set at creation via
      // NewTripForm's "documenting a past trip" checkbox, or toggled on
      // later) has nothing left to decide: everything in it already
      // happened. One plain section instead of the Possible/Previously
      // pair, named for the category itself rather than "Options"/
      // "Previously ..." wording that only makes sense when something's
      // still being weighed — and with no ranking/ratings/pairing, its
      // entries auto-mark Visited on add (see the entries POST route).
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
            supportsRanking: false,
            supportsRatings: false,
            cardLayout,
            newNavGroupLabel: template.navGroupLabel,
            fieldDefs: template.fieldDefs,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to create section");
        refresh();
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
          supportsRanking: isHouses,
          supportsRatings: isHouses,
          cardLayout,
          newNavGroupLabel: template.navGroupLabel,
          fieldDefs: template.fieldDefs,
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
          // any more than it needs ranking or driving-times/map.
          supportsPairing: false,
          hasMap: false,
          supportsRanking: false,
          supportsRatings: false,
          cardLayout,
          navGroupId: possibleData.section.nav_group_id,
          fieldDefs: template.fieldDefs,
        }),
      });
      const previousData = await previousRes.json();
      if (!previousRes.ok) {
        throw new Error(
          `Created "${template.possible.label}", but "${template.previous.label}" failed: ${previousData.error || "unknown error"}`
        );
      }

      refresh();
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
            ? "This trip is marked Completed, so each template creates just one plain section (e.g. \"Stays\", not a Stay Options / Stayed Before pair) — there's nothing left to decide, so anything added comes in already checked off Visited."
            : 'Each creates a ready-made "Options" / "Before" pair (e.g. House Options / Stayed Before) — fully editable or deletable afterward, this is just a fast starting point.'}
        </p>
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
      </div>

      {nav.every((g) => g.sections.length === 0) && (
        <p className={styles["empty-hint"]}>No sections yet — add one from a template above, or create a custom one.</p>
      )}

      {nav.map(
        (group) =>
          group.sections.length > 0 && (
            <div key={group.id} className={styles["group-section"]}>
              <h2 className={styles["section-heading"]}>{group.label}</h2>
              <div className={styles["section-list"]}>
                {group.sections.map((section) => (
                  <div
                    key={section.id}
                    className={section.enabled ? styles["section-card"] : styles["section-card-disabled"]}
                  >
                    <div>
                      <div className={styles["section-label"]}>{section.label}</div>
                      <div className={styles["section-meta"]}>
                        /{trip.slug}/{group.slug}/{section.slug}
                        {!section.enabled && " · disabled"}
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
