"use client";

import { useEffect, useState } from "react";
import classNames from "classnames";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SECTION_TEMPLATES, type SectionTemplate } from "@/lib/sectionTemplates";
import type { CustomSectionTemplate } from "@/lib/customSectionTemplates";
import { PRIMARY_TIER_SORT_ORDER, PAST_TIER_SORT_ORDER, VISITED_PREFIX, looksLikePastTier } from "@/lib/sectionLabels";
import AddSectionDialog from "./AddSectionDialog";
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
  const [removingSectionId, setRemovingSectionId] = useState<string | null>(null);
  // Which template a click is currently asking "add a Visited
  // counterpart too?" about, via AddSectionDialog — null whenever
  // nothing has anything to ask (a completed trip, or a template that
  // already has its own past tier) skips this and just adds directly.
  const [pendingAdd, setPendingAdd] = useState<{ kind: "builtin"; template: SectionTemplate } | { kind: "custom"; template: CustomSectionTemplate } | null>(
    null
  );
  const [customTemplates, setCustomTemplates] = useState<CustomSectionTemplate[]>([]);
  // Native HTML5 drag and drop, id of whichever nav group is currently
  // being dragged. Only whole groups are draggable — see reorderGroups
  // below for why sections themselves aren't independently reorderable.
  const [draggingGroupId, setDraggingGroupId] = useState<string | null>(null);
  // Which group is currently being dragged over, and whether the drop
  // would land before or after it (based on which half of it the
  // pointer is over) — drives both the insertion-line indicator and
  // reorderGroups' own target index, since without this a drop only
  // ever meant "swap to this exact spot," with no way to land after the
  // very last group and no visible cue of where it'd land at all.
  const [dragOverGroupId, setDragOverGroupId] = useState<string | null>(null);
  const [dropPosition, setDropPosition] = useState<"before" | "after">("before");

  const apiBase = `/api/trips/${trip.slug}/sections`;
  // Only a group that actually still has a section in it counts as
  // "existing" — removing a group's last section (see removeSection)
  // used to leave the empty group behind, permanently blocking that
  // same template's own button from ever being clickable again
  // (confirmed live: Car Services/Shops/Wineries all stuck showing
  // "✓ already exists" after their one section was removed).
  const existingGroupLabels = new Set(nav.filter((g) => g.sections.length > 0).map((g) => g.label));

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

  // Same DELETE the section's own edit-page DangerZone uses (every
  // entry/field_defs row cascades via the DB's own `on delete
  // cascade`) — offered right here too so removing one doesn't need a
  // detour through Edit first. Plain confirm rather than DangerZone's
  // own type-the-name dance — this is still one deliberate click plus
  // an explicit "yes," not a stray misclick, and "Enabled" right next
  // to it already covers "hide it without losing anything" for
  // anyone who wasn't sure this was permanent.
  async function removeSection(section: Section, navGroupSlug: string) {
    if (!window.confirm(`Permanently delete "${section.label}" and every entry in it? This can't be undone.`)) {
      return;
    }
    setError("");
    setRemovingSectionId(section.id);
    try {
      const res = await fetch(`${apiBase}/${navGroupSlug}/${section.slug}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json()).error || "Delete failed");
      refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setRemovingSectionId(null);
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
  async function reorderGroups(draggedId: string, targetId: string, position: "before" | "after") {
    if (draggedId === targetId) return;
    const ids = nav.map((g) => g.id);
    const fromIndex = ids.indexOf(draggedId);
    if (fromIndex === -1 || ids.indexOf(targetId) === -1) return;

    const reordered = [...nav];
    const [moved] = reordered.splice(fromIndex, 1);
    // Re-find the target's index after removing the dragged group —
    // removing an earlier item shifts everything after it back by one.
    let insertAt = reordered.findIndex((g) => g.id === targetId);
    if (position === "after") insertAt += 1;
    reordered.splice(insertAt, 0, moved);
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

  async function addTemplate(template: SectionTemplate, withCounterpart: boolean) {
    setError("");
    setAddingTemplate(template.key);
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
            supportsConcerns: false,
            cardLayout,
            newNavGroupLabel: template.navGroupLabel,
            fieldDefs: template.fieldDefs,
            skipTemplateCapture: true,
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
          supportsRatings: isHouses,
          supportsConcerns: isHouses,
          cardLayout,
          newNavGroupLabel: template.navGroupLabel,
          fieldDefs: template.fieldDefs,
          skipTemplateCapture: true,
          sortOrder: PRIMARY_TIER_SORT_ORDER,
        }),
      });
      const possibleData = await possibleRes.json();
      if (!possibleRes.ok) throw new Error(possibleData.error || "Failed to create section");

      // Decided in AddSectionDialog before this ever runs, not a plain
      // browser confirm — this used to always silently create both
      // halves, no way to add just one without deleting the other
      // afterward.
      if (!withCounterpart) {
        refresh();
        return;
      }

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
          supportsConcerns: false,
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

      refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setAddingTemplate(null);
    }
  }

  function templateHasPastTier(template: CustomSectionTemplate): boolean {
    return template.sections.some(looksLikePastTier);
  }

  // Recreates a custom template's whole nav group — one, two, or
  // however many sections it was captured with (see
  // lib/customSectionTemplates.ts) — in the same one-nav-group-per-call
  // shape the built-in templates use above: the first section names the
  // new nav group, every one after reuses the id that came back. A
  // template that doesn't already have its own past tier can also get
  // the same "Visited ..." counterpart "+ New section" offers, decided
  // in AddSectionDialog before this ever runs — same shape SectionForm's
  // own addCounterpart builds, keyed off the template's primary section
  // rather than a freshly-typed label/slug.
  async function addCustomTemplate(template: CustomSectionTemplate, withCounterpart: boolean) {
    setError("");
    setAddingTemplate(template.template_key);
    // Same collapsing the 3 built-in templates already do above for a
    // completed trip — nothing left to decide, so a still-deciding
    // "Options" tier plus its own "Visited"/"Previously ..." counterpart
    // is one section too many (confirmed live: adding a custom
    // "Distilleries" template to an already-completed trip created
    // both, unlike the built-ins). Sections here have no fixed
    // possible/previous shape to key off of the way SECTION_TEMPLATES
    // does, so this keys off content instead — whichever section
    // already reads as the past tier (see looksLikePastTier) — and
    // falls back to every section as-is if none does (a template with
    // no visited/previous counterpart in the first place has nothing
    // to collapse).
    const pastTierSections = template.sections.filter(looksLikePastTier);
    const sectionsToCreate = trip.completed && pastTierSections.length > 0 ? pastTierSections : template.sections;
    try {
      let navGroupId: string | undefined;
      // Array order is intentional (the primary section is always
      // captured first — see lib/customSectionTemplates.ts) — index
      // doubles as a real sort_order instead of leaving every section
      // tied at the route's own bare default, which is exactly what
      // let real trips' display order come out inconsistent/reversed.
      for (const [i, s] of sectionsToCreate.entries()) {
        const res = await fetch(apiBase, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            slug: s.slug,
            // Plain category naming ("Distilleries," not "Visited
            // Distilleries") once collapsed to one section — same
            // reasoning as the built-ins' own trip.completed branch.
            label: trip.completed && pastTierSections.length > 0 ? template.nav_group_label : s.label,
            subNavLabel: s.subNavLabel,
            addPlaceholder: s.addPlaceholder,
            emptyMessage: s.emptyMessage,
            supportsPairing: s.supportsPairing,
            hasMap: s.hasMap,
            supportsRatings: s.supportsRatings,
            supportsConcerns: s.supportsConcerns ?? false,
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

      // Only when there was nothing to collapse (a completed trip's own
      // "nothing left to decide" branch above already leaves no
      // Options/Visited split to add a counterpart to) and the dialog's
      // own checkbox was actually checked.
      const primary = template.sections[0];
      if (!trip.completed && pastTierSections.length === 0 && withCounterpart) {
        const primaryLabel = primary.label;
        const counterpartRes = await fetch(apiBase, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            slug: `${primary.slug}-visited`,
            label: `${VISITED_PREFIX} ${primaryLabel}`,
            subNavLabel: VISITED_PREFIX,
            addPlaceholder: `Paste a link for a ${primaryLabel.toLowerCase()} you've already been to...`,
            emptyMessage: `No previous ${primaryLabel.toLowerCase()} yet — paste a link above.`,
            supportsPairing: false,
            hasMap: false,
            supportsRatings: false,
            supportsConcerns: false,
            cardLayout: primary.cardLayout,
            navGroupId,
            fieldDefs: primary.fieldDefs,
            skipTemplateCapture: true,
            sortOrder: PAST_TIER_SORT_ORDER,
          }),
        });
        const counterpartData = await counterpartRes.json();
        if (!counterpartRes.ok) {
          throw new Error(`Created "${template.nav_group_label}", but its counterpart failed: ${counterpartData.error || "unknown error"}`);
        }
      }

      refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setAddingTemplate(null);
    }
  }

  // A completed trip, or a custom template that already has its own
  // past tier, has nothing to ask about — same collapsing logic
  // addTemplate/addCustomTemplate already apply internally, checked
  // here too so the dialog never opens promising a choice that
  // wouldn't actually do anything.
  function handleTemplateClick(t: SectionTemplate) {
    if (trip.completed) addTemplate(t, false);
    else setPendingAdd({ kind: "builtin", template: t });
  }

  function handleCustomTemplateClick(t: CustomSectionTemplate) {
    if (trip.completed || templateHasPastTier(t)) addCustomTemplate(t, false);
    else setPendingAdd({ kind: "custom", template: t });
  }

  async function handlePendingAddConfirm(withCounterpart: boolean) {
    if (!pendingAdd) return;
    if (pendingAdd.kind === "builtin") await addTemplate(pendingAdd.template, withCounterpart);
    else await addCustomTemplate(pendingAdd.template, withCounterpart);
    setPendingAdd(null);
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
            : 'Each creates an "Options" section, then asks if you also want a "Before" counterpart — fully editable afterward.'}
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
                onClick={() => handleTemplateClick(t)}
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
                    onClick={() => handleCustomTemplateClick(t)}
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

      {pendingAdd && (
        <AddSectionDialog
          open
          onOpenChange={(open) => {
            if (!open) setPendingAdd(null);
          }}
          primaryLabel={pendingAdd.kind === "builtin" ? pendingAdd.template.possible.label : pendingAdd.template.nav_group_label}
          counterpartLabel={
            pendingAdd.kind === "builtin" ? pendingAdd.template.previous.label : `${VISITED_PREFIX} ${pendingAdd.template.sections[0].label}`
          }
          onConfirm={handlePendingAddConfirm}
          creating={addingTemplate === (pendingAdd.kind === "builtin" ? pendingAdd.template.key : pendingAdd.template.template_key)}
        />
      )}

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
                if (!draggingGroupId || draggingGroupId === group.id) return;
                // Which half of this group the pointer is over decides
                // whether the drop lands before or after it — this is
                // also what makes landing after the very last group
                // possible at all, and what the indicator line below
                // is actually showing.
                const rect = e.currentTarget.getBoundingClientRect();
                const position = e.clientY > rect.top + rect.height / 2 ? "after" : "before";
                setDragOverGroupId(group.id);
                setDropPosition(position);
              }}
              onDragLeave={(e) => {
                // dragenter/dragleave fire on every child too, not just
                // this element — only clear the indicator once the
                // pointer has actually left this whole group, not just
                // moved from one of its children to another.
                if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
                  setDragOverGroupId((id) => (id === group.id ? null : id));
                }
              }}
              onDrop={(e) => {
                e.preventDefault();
                if (draggingGroupId) reorderGroups(draggingGroupId, group.id, dropPosition);
                setDraggingGroupId(null);
                setDragOverGroupId(null);
              }}
              onDragEnd={() => {
                setDraggingGroupId(null);
                setDragOverGroupId(null);
              }}
              className={classNames(
                styles["group-section"],
                draggingGroupId === group.id && styles["dragging"],
                dragOverGroupId === group.id && dropPosition === "before" && styles["drop-before"],
                dragOverGroupId === group.id && dropPosition === "after" && styles["drop-after"]
              )}
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
                      <button
                        type="button"
                        onClick={() => removeSection(section, group.slug)}
                        disabled={removingSectionId === section.id}
                        className={styles["remove-link"]}
                      >
                        {removingSectionId === section.id ? "Removing..." : "Remove"}
                      </button>
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
