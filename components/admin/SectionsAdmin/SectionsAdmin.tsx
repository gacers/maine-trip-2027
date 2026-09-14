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
    // better two to a row — both tiers of a category share this, unlike
    // hasMap which differs between them.
    const compactCards = template.key !== "houses";
    // Pairing (2-item options) and manual ranking only make sense for a
    // still-deciding house-options list — Food & Drink/Activities never
    // want either, and a "previous" list has nothing left to rank.
    const isHouses = template.key === "houses";
    try {
      const possibleRes = await fetch(apiBase, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: template.possible.slug,
          label: template.possible.label,
          addPlaceholder: template.possible.addPlaceholder,
          emptyMessage: template.possible.emptyMessage,
          supportsPairing: isHouses,
          hasMap: true,
          supportsRanking: isHouses,
          supportsRatings: isHouses,
          compactCards,
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
          compactCards,
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
    <div className={styles.wrapper}>
      <div className={styles.header}>
        <h1 className={styles.title}>Sections</h1>
        <Link href={`/${trip.slug}/admin/sections/new`} className={styles.newSectionButton}>
          + New section
        </Link>
      </div>

      {error && <p className={styles.error}>{error}</p>}

      <div className={styles.templatesSection}>
        <h2 className={styles.sectionHeading}>Add from a template</h2>
        <p className={styles.templatesHint}>
          Each creates a ready-made &quot;Options&quot; / &quot;Before&quot; pair (e.g. House Options / Stayed
          Before) — fully editable or deletable afterward, this is just a fast starting point.
        </p>
        <div className={styles.templateList}>
          {SECTION_TEMPLATES.map((t) => {
            const exists = existingGroupLabels.has(t.navGroupLabel);
            return (
              <button
                key={t.key}
                type="button"
                disabled={exists || addingTemplate === t.key}
                onClick={() => addTemplate(t)}
                className={styles.templateButton}
                title={exists ? `${t.navGroupLabel} already exists` : undefined}
              >
                {addingTemplate === t.key ? "Adding..." : exists ? `${t.navGroupLabel} ✓` : `+ ${t.navGroupLabel}`}
              </button>
            );
          })}
        </div>
      </div>

      {nav.every((g) => g.sections.length === 0) && (
        <p className={styles.emptyHint}>No sections yet — add one from a template above, or create a custom one.</p>
      )}

      {nav.map(
        (group) =>
          group.sections.length > 0 && (
            <div key={group.id} className={styles.groupSection}>
              <h2 className={styles.sectionHeading}>{group.label}</h2>
              <div className={styles.sectionList}>
                {group.sections.map((section) => (
                  <div key={section.id} className={section.enabled ? styles.sectionCard : styles.sectionCardDisabled}>
                    <div>
                      <div className={styles.sectionLabel}>{section.label}</div>
                      <div className={styles.sectionMeta}>
                        /{trip.slug}/{group.slug}/{section.slug}
                        {!section.enabled && " · disabled"}
                      </div>
                    </div>
                    <div className={styles.sectionActions}>
                      <label className={styles.enabledCheckboxLabel}>
                        <input
                          type="checkbox"
                          checked={section.enabled}
                          onChange={(e) => toggleEnabled(section, group.slug, e.target.checked)}
                          className={styles.enabledCheckbox}
                        />
                        Enabled
                      </label>
                      <Link
                        href={`/${trip.slug}/admin/sections/${group.slug}/${section.slug}/edit`}
                        className={styles.editLink}
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
