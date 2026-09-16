"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SECTION_TEMPLATES, type SectionTemplate } from "@/lib/sectionTemplates";
import type { CustomSectionTemplate } from "@/lib/customSectionTemplates";
import type { PublicTrip, NavGroup, Section } from "@/lib/types";
import styles from "./SectionsAdmin.module.css";

export interface SectionsAdminProps {
  trip: PublicTrip;
  nav: NavGroup[];
}

export default function SectionsAdmin({ trip, nav: initialNav }: SectionsAdminProps) {
  const router = useRouter();
  const [nav, setNav] = useState(initialNav);
  const [error, setError] = useState("");
  const [addingTemplate, setAddingTemplate] = useState<string | null>(null);
  const [customTemplates, setCustomTemplates] = useState<CustomSectionTemplate[]>([]);

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
  // new nav group, every one after reuses the id that came back.
  async function addCustomTemplate(template: CustomSectionTemplate) {
    setError("");
    setAddingTemplate(template.template_key);
    const isFirstSection = nav.every((g) => g.sections.length === 0);
    try {
      let navGroupId: string | undefined;
      for (const s of template.sections) {
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
