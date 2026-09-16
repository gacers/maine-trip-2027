"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SECTION_TEMPLATES, type SectionTemplate } from "@/lib/sectionTemplates";
import type { CustomSectionTemplate } from "@/lib/customSectionTemplates";
import type { CandidateSection } from "@/lib/entries";
import PrefillPicker from "./components/PrefillPicker";
import type { PublicTrip, NavGroup, Section } from "@/lib/types";
import styles from "./SectionsAdmin.module.css";

export interface SectionsAdminProps {
  trip: PublicTrip;
  nav: NavGroup[];
}

// A "-visited" tier and its own primary section are the same concept
// as far as prefilling goes — either one, on any other trip, counts as
// "this already exists somewhere" (see lib/entries.ts's
// findCandidateSectionsForConceptSlug).
function conceptSlugFor(sectionSlug: string): string {
  return sectionSlug.replace(/-visited$/, "");
}

// The section's own slug alone isn't a safe cache/lookup key — every
// built-in category's two tiers are always literally "options"/
// "previously-visited" regardless of which category they're actually
// in, so this pairs it with the nav group's own slug (see
// findCandidateSectionsForConceptSlug for why that's what actually
// disambiguates them).
function cacheKeyFor(navGroupSlug: string, sectionSlug: string): string {
  return `${navGroupSlug}::${conceptSlugFor(sectionSlug)}`;
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
  // Every real candidate section to prefill from, for a given concept
  // slug (e.g. "distilleries") — see the import-candidates route.
  // Shared across every picker on the page keyed to the same concept,
  // rather than re-fetching per row. Undefined means "not fetched yet".
  const [candidatesByConceptSlug, setCandidatesByConceptSlug] = useState<Record<string, CandidateSection[] | undefined>>(
    {}
  );
  // The currently-selected source section id in each PrefillPicker on
  // the page — keyed by whatever identifies that picker's own target
  // (a template_key or an existing single-tier group's primary section
  // id for a not-yet-created past section; the section's own id once
  // it's a real, already-existing row — see applyPrefill). "" means
  // "don't prefill"/"not prefilled".
  const [pendingSourceByKey, setPendingSourceByKey] = useState<Record<string, string>>({});

  const apiBase = `/api/trips/${trip.slug}/sections`;
  const existingGroupLabels = new Set(nav.map((g) => g.label));

  function ensureCandidates(navGroupSlug: string, sectionSlug: string) {
    const key = cacheKeyFor(navGroupSlug, sectionSlug);
    if (candidatesByConceptSlug[key] !== undefined) return;
    const params = new URLSearchParams({ navGroupSlug, slug: conceptSlugFor(sectionSlug) });
    fetch(`/api/trips/${trip.slug}/import-candidates?${params}`)
      .then((res) => res.json())
      .then((data) => setCandidatesByConceptSlug((prev) => ({ ...prev, [key]: data.candidates || [] })))
      .catch(() => setCandidatesByConceptSlug((prev) => ({ ...prev, [key]: [] })));
  }

  // Every custom nav group any trip has ever built — see
  // lib/customSectionTemplates.ts. Not trip-scoped, so this loads once
  // regardless of which trip's admin page it's rendered on.
  useEffect(() => {
    fetch("/api/section-templates", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => setCustomTemplates(data.templates || []))
      .catch(() => {});
  }, []);

  // Up-front candidates for every section already on this trip — not
  // just a single-tier group's own primary (used by "+ Add a
  // Previously Visited version") but any section at all, so the "copy
  // in existing entries" picker on an already-existing section is
  // never a beat behind a click. Re-runs whenever `nav` changes; cheap,
  // this trip usually has a handful of sections at most.
  useEffect(() => {
    for (const g of nav) for (const section of g.sections) ensureCandidates(g.slug, section.slug);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nav]);

  // Same idea for every custom template on offer — its own candidates
  // are fetched as soon as the template list itself loads (not gated
  // behind first checking "+ Previously Visited version too"), so that
  // checkbox's own picker never has to wait on a fetch either.
  // template_key IS this template's own nav group slug (see
  // lib/customSectionTemplates.ts's slugifyTemplateKey — the same
  // algorithm the sections POST route uses for a real newNavGroupLabel),
  // so it's exactly what identifies "the same nav group concept"
  // wherever this template's already been used for real.
  useEffect(() => {
    for (const t of customTemplates) ensureCandidates(t.template_key, t.sections[0].slug);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customTemplates]);

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

  // Shared by every "copy in existing entries" call site below — POSTs
  // to the entries/import route and throws with its real error message
  // on failure, so each caller's own try/catch can prefix it with
  // whatever context makes sense there.
  async function runImport(destSectionId: string, sourceSectionId: string | null, overwrite: boolean): Promise<number> {
    const res = await fetch(`/api/trips/${trip.slug}/entries/import`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sectionId: destSectionId, sourceSectionId: sourceSectionId || undefined, overwrite }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Copy failed");
    return data.imported as number;
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

  function togglePastVersion(key: string, checked: boolean) {
    setAddPastVersion((prev) => {
      const next = new Set(prev);
      if (checked) next.add(key);
      else next.delete(key);
      return next;
    });
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

        const sourceSectionId = pendingSourceByKey[template.template_key];
        if (sourceSectionId) {
          try {
            await runImport(pastData.section.id, sourceSectionId, false);
          } catch (err) {
            throw new Error(`Created "Previously Visited ${primary.label}", but copying in existing entries failed: ${(err as Error).message}`);
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

      const sourceSectionId = pendingSourceByKey[primary.id];
      if (sourceSectionId) {
        try {
          await runImport(pastData.section.id, sourceSectionId, false);
        } catch (err) {
          throw new Error(`Created the Previously Visited version, but copying in existing entries failed: ${(err as Error).message}`);
        }
      }

      refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setAddingTemplate(null);
    }
  }

  // Applies (or changes, or clears) an already-existing section's own
  // prefill — runnable at any time, not just at the moment a past tier
  // is first created, since forgetting to pick a source then otherwise
  // left no way back in to do it later. Warns before touching anything
  // the section already has in it, whether that's replacing it with a
  // freshly-picked source or clearing it out entirely (picking "— Don't
  // prefill —" after it was already populated this way) — appending
  // instead would just leave duplicates sitting next to whatever's
  // already there, and silently doing either without asking isn't OK
  // for something this destructive-if-wrong.
  async function applyPrefill(group: NavGroup, section: Section) {
    const sourceSectionId = pendingSourceByKey[section.id] || "";
    setError("");
    setAddingTemplate(section.id);
    try {
      const entriesRes = await fetch(`/api/trips/${trip.slug}/sections/${group.slug}/${section.slug}/entries`, {
        cache: "no-store",
      });
      const entriesData = await entriesRes.json();
      const existingCount = (entriesData.entries || []).length;
      if (!sourceSectionId && existingCount === 0) return;
      if (existingCount > 0) {
        const confirmed = window.confirm(
          sourceSectionId
            ? `This section already has ${existingCount} ${existingCount === 1 ? "entry" : "entries"}. Picking a new source will replace ${existingCount === 1 ? "it" : "them"} with fresh copies from there — continue?`
            : `Remove the ${existingCount} ${existingCount === 1 ? "entry" : "entries"} currently in this section?`
        );
        if (!confirmed) return;
      }

      await runImport(section.id, sourceSectionId || null, existingCount > 0);
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
                          onChange={(e) => togglePastVersion(t.template_key, e.target.checked)}
                        />
                        + Previously Visited version too
                      </label>
                    )}
                    {canAddPastVersion && !exists && addPastVersion.has(t.template_key) && (
                      <PrefillPicker
                        candidates={candidatesByConceptSlug[cacheKeyFor(t.template_key, t.sections[0].slug)] || []}
                        value={pendingSourceByKey[t.template_key] || ""}
                        onChange={(v) => setPendingSourceByKey((prev) => ({ ...prev, [t.template_key]: v }))}
                      />
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
                {group.sections.map((section) => {
                  const candidates = candidatesByConceptSlug[cacheKeyFor(group.slug, section.slug)] || [];
                  return (
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
                        {candidates.length > 0 && (
                          <>
                            <PrefillPicker
                              candidates={candidates}
                              value={pendingSourceByKey[section.id] || ""}
                              onChange={(v) => setPendingSourceByKey((prev) => ({ ...prev, [section.id]: v }))}
                              disabled={addingTemplate === section.id}
                            />
                            <button
                              type="button"
                              disabled={addingTemplate === section.id}
                              onClick={() => applyPrefill(group, section)}
                              className={styles["edit-button"]}
                            >
                              {addingTemplate === section.id ? "Applying..." : "Apply"}
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
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
                  <PrefillPicker
                    candidates={candidatesByConceptSlug[cacheKeyFor(group.slug, group.sections[0].slug)] || []}
                    value={pendingSourceByKey[group.sections[0].id] || ""}
                    onChange={(v) => setPendingSourceByKey((prev) => ({ ...prev, [group.sections[0].id]: v }))}
                  />
                </div>
              )}
            </div>
          )
      )}
    </div>
  );
}
