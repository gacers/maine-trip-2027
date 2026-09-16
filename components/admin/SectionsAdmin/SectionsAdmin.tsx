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
  // Per-template opt-in for the "also add a Previously Visited version"
  // checkbox below a single-section custom template — see
  // addCustomTemplate. Keyed by template_key.
  const [addPastVersion, setAddPastVersion] = useState<Set<string>>(new Set());
  // Once a template's past-version checkbox is on, lazily fetched: what
  // else already exists for this same concept on other trips (e.g. a
  // 2022 Scotland trip's own already-curated Distilleries list) — see
  // the import-candidates route. Keyed by template_key; undefined means
  // "not fetched yet", null means "fetched, nothing found".
  const [importCandidates, setImportCandidates] = useState<Record<string, { count: number; tripNames: string[] } | null>>({});
  const [importSelected, setImportSelected] = useState<Set<string>>(new Set());
  // Same idea as the two above, for a nav group that ALREADY exists on
  // THIS trip with just one tier so far (e.g. a custom "Distilleries"
  // section added before it ever needed a Previously Visited half) —
  // see addPastVersionToExistingGroup. Keyed by section.id.
  const [existingImportCandidates, setExistingImportCandidates] = useState<
    Record<string, { count: number; tripNames: string[] } | null>
  >({});
  const [existingImportSelected, setExistingImportSelected] = useState<Set<string>>(new Set());

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

  // For every nav group on THIS trip that's still just one tier (no
  // Previously Visited half yet), check up front what already exists
  // elsewhere for that same concept — cheap (this trip usually has a
  // handful of groups at most) and means the "+ Add a Previously
  // Visited version" button's own import checkbox is never a beat
  // behind a click. Re-runs whenever `nav` changes (a group's own
  // single-vs-multi-section count can change after adding one).
  useEffect(() => {
    const singleSectionGroups = nav.filter((g) => g.sections.length === 1);
    for (const g of singleSectionGroups) {
      const section = g.sections[0];
      if (existingImportCandidates[section.id] !== undefined) continue;
      fetch(`/api/trips/${trip.slug}/import-candidates?slug=${encodeURIComponent(section.slug)}`)
        .then((res) => res.json())
        .then((data) =>
          setExistingImportCandidates((prev) => ({
            ...prev,
            [section.id]: data.count > 0 ? { count: data.count, tripNames: data.tripNames } : null,
          }))
        )
        .catch(() => setExistingImportCandidates((prev) => ({ ...prev, [section.id]: null })));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nav]);

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

  // Checking a template's "also add a Previously Visited version"
  // fires off a one-time lookup of what already exists for this same
  // concept elsewhere, so the nested "also copy in" checkbox can show a
  // real count instead of a blind guess. Unchecking doesn't re-fetch —
  // the count doesn't need to disappear along with the option to use it.
  function togglePastVersion(template: CustomSectionTemplate, checked: boolean) {
    setAddPastVersion((prev) => {
      const next = new Set(prev);
      if (checked) next.add(template.template_key);
      else next.delete(template.template_key);
      return next;
    });
    if (checked && importCandidates[template.template_key] === undefined) {
      const slug = template.sections[0].slug;
      fetch(`/api/trips/${trip.slug}/import-candidates?slug=${encodeURIComponent(slug)}`)
        .then((res) => res.json())
        .then((data) =>
          setImportCandidates((prev) => ({
            ...prev,
            [template.template_key]: data.count > 0 ? { count: data.count, tripNames: data.tripNames } : null,
          }))
        )
        .catch(() => setImportCandidates((prev) => ({ ...prev, [template.template_key]: null })));
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
    // Most custom templates were captured from a single plain section
    // (unlike the 3 built-ins, which always come as an Options/
    // Previously pair) — this is the optional equivalent of
    // SectionForm's own "also add a Previously Visited version"
    // checkbox for a brand-new custom section, offered here too so a
    // template that's only ever existed as one tier isn't stuck that
    // way forever. Same field defs as the primary (same shape/"data"),
    // never pairing/map/ratings, same as every other "previous" tier.
    const wantsPastVersion = template.sections.length === 1 && addPastVersion.has(template.template_key);
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

      if (wantsPastVersion) {
        const primary = template.sections[0];
        const pastRes = await fetch(apiBase, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            slug: `${primary.slug}-visited`,
            label: `Previously Visited ${primary.label}`,
            subNavLabel: "Previously Visited",
            addPlaceholder: `Paste a link for a ${primary.label.toLowerCase()} you've already been to...`,
            emptyMessage: `No previous ${primary.label.toLowerCase()} yet — paste a link above.`,
            supportsPairing: false,
            hasMap: false,
            supportsRatings: false,
            cardLayout: primary.cardLayout,
            fieldDefs: primary.fieldDefs,
            skipTemplateCapture: true,
            navGroupId,
          }),
        });
        const pastData = await pastRes.json();
        if (!pastRes.ok) {
          throw new Error(`Created "${template.nav_group_label}", but its Previously Visited version failed: ${pastData.error || "unknown error"}`);
        }

        // "Also copy in existing entries" — pulls in every matching
        // entry from every OTHER trip's same-concept section (see the
        // entries/import route), straight into the tier that's meant to
        // hold exactly this kind of thing.
        if (importSelected.has(template.template_key)) {
          const importRes = await fetch(`/api/trips/${trip.slug}/entries/import`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sectionId: pastData.section.id, conceptSlug: primary.slug }),
          });
          const importData = await importRes.json();
          if (!importRes.ok) {
            throw new Error(`Created "Previously Visited ${primary.label}", but copying in existing entries failed: ${importData.error || "unknown error"}`);
          }
        }
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

  // The exact same "also add a Previously Visited version" option as
  // addCustomTemplate above, but for a nav group that's already real on
  // THIS trip (e.g. a custom "Distilleries" section added by hand
  // before it ever needed a past tier) rather than one still just a
  // template on offer — addCustomTemplate's own button is unreachable
  // here since the nav group already exists (its "already exists" ✓
  // state disables it). Deliberately does NOT skip template capture:
  // landing in the same nav group as an existing captured template
  // (or becoming a fresh one, for a genuinely new custom section) means
  // this enriches that template with a past tier for every other trip
  // to reuse too, same as it always has for a brand-new custom section.
  async function addPastVersionToExistingGroup(group: NavGroup, primary: Section) {
    setError("");
    setAddingTemplate(primary.id);
    try {
      const pastRes = await fetch(apiBase, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: `${primary.slug}-visited`,
          label: `Previously Visited ${primary.label}`,
          subNavLabel: "Previously Visited",
          addPlaceholder: `Paste a link for a ${primary.label.toLowerCase()} you've already been to...`,
          emptyMessage: `No previous ${primary.label.toLowerCase()} yet — paste a link above.`,
          supportsPairing: false,
          hasMap: false,
          supportsRatings: false,
          cardLayout: primary.card_layout,
          fieldDefs: (primary.field_defs || []).map((f) => ({
            key: f.key,
            label: f.label,
            field_type: f.field_type,
            show_on_overview: f.show_on_overview,
            options: f.options || undefined,
          })),
          navGroupId: group.id,
        }),
      });
      const pastData = await pastRes.json();
      if (!pastRes.ok) throw new Error(pastData.error || "Failed to create Previously Visited version");

      if (existingImportSelected.has(primary.id)) {
        const importRes = await fetch(`/api/trips/${trip.slug}/entries/import`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sectionId: pastData.section.id, conceptSlug: primary.slug }),
        });
        const importData = await importRes.json();
        if (!importRes.ok) {
          throw new Error(`Created the Previously Visited version, but copying in existing entries failed: ${importData.error || "unknown error"}`);
        }
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
                const canAddPastVersion = t.sections.length === 1;
                return (
                  <div key={t.template_key} className={styles["custom-template-item"]}>
                    <button
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
                    {canAddPastVersion && !exists && (
                      <label className={styles["past-version-checkbox"]}>
                        <input
                          type="checkbox"
                          checked={addPastVersion.has(t.template_key)}
                          onChange={(e) => togglePastVersion(t, e.target.checked)}
                        />
                        + Previously Visited version too
                      </label>
                    )}
                    {canAddPastVersion &&
                      !exists &&
                      addPastVersion.has(t.template_key) &&
                      importCandidates[t.template_key] && (
                        <label className={styles["past-version-checkbox"]}>
                          <input
                            type="checkbox"
                            checked={importSelected.has(t.template_key)}
                            onChange={(e) =>
                              setImportSelected((prev) => {
                                const next = new Set(prev);
                                if (e.target.checked) next.add(t.template_key);
                                else next.delete(t.template_key);
                                return next;
                              })
                            }
                          />
                          Also copy in {importCandidates[t.template_key]!.count} existing{" "}
                          {importCandidates[t.template_key]!.count === 1 ? "entry" : "entries"} from{" "}
                          {importCandidates[t.template_key]!.tripNames.join(", ")}
                        </label>
                      )}
                  </div>
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
              {group.sections.length === 1 && !trip.completed && (
                <div className={styles["custom-template-item"]}>
                  <button
                    type="button"
                    disabled={addingTemplate === group.sections[0].id}
                    onClick={() => addPastVersionToExistingGroup(group, group.sections[0])}
                    className={styles["template-button"]}
                  >
                    {addingTemplate === group.sections[0].id ? "Adding..." : "+ Add a Previously Visited version"}
                  </button>
                  {existingImportCandidates[group.sections[0].id] && (
                    <label className={styles["past-version-checkbox"]}>
                      <input
                        type="checkbox"
                        checked={existingImportSelected.has(group.sections[0].id)}
                        onChange={(e) =>
                          setExistingImportSelected((prev) => {
                            const next = new Set(prev);
                            if (e.target.checked) next.add(group.sections[0].id);
                            else next.delete(group.sections[0].id);
                            return next;
                          })
                        }
                      />
                      Also copy in {existingImportCandidates[group.sections[0].id]!.count} existing{" "}
                      {existingImportCandidates[group.sections[0].id]!.count === 1 ? "entry" : "entries"} from{" "}
                      {existingImportCandidates[group.sections[0].id]!.tripNames.join(", ")}
                    </label>
                  )}
                </div>
              )}
            </div>
          )
      )}
    </div>
  );
}
