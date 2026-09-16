"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import FieldDefsEditor, { fieldDefToRow, rowToFieldDef, type FieldRow } from "./components/FieldDefsEditor";
import SectionOptionsFields from "./components/SectionOptionsFields";
import CounterpartOption from "./components/CounterpartOption";
import PrefillPanel from "./components/PrefillPanel";
import type { PublicTrip, NavGroup, Section } from "@/lib/types";
import styles from "./SectionForm.module.css";

function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// A best-effort "is this a Previously Visited-style tier" check — the
// Prefill panel below only makes sense there (pulling in already-
// documented, already-visited places), not on a still-deciding
// Options-style tier. No explicit "tier" column exists to check
// instead; slug/label naming is consistent enough in practice (every
// built-in and custom past tier this app has ever created matches one
// of these) that a real tag column isn't worth adding just for this.
function looksLikePastTier(s: Section): boolean {
  return /previous|visited|past/i.test(`${s.slug} ${s.label} ${s.sub_nav_label || ""}`);
}

export interface SectionFormProps {
  trip: PublicTrip;
  // Just enough of a NavGroup to populate the picker (id + label) — the
  // pages that render this form strip `sections` off before passing
  // these down, so it's never actually present here.
  navGroups: Omit<NavGroup, "sections">[];
  section?: Section | null;
}

// Shared by both the "New section" and "Edit section" admin pages —
// the create/update API contract (POST/PATCH) is almost identical, this
// form just switches which one it calls.
export default function SectionForm({ trip, navGroups, section }: SectionFormProps) {
  const router = useRouter();
  const isEdit = !!section;
  // The section's *current* nav group slug (not whatever the picker
  // below might be pending-moving it to) — this identifies where the
  // record already lives, for both the PATCH URL and the Prefill
  // panel's own lookup.
  const currentNavGroupSlug = navGroups.find((g) => g.id === section?.nav_group_id)?.slug;

  const [label, setLabel] = useState(section?.label || "");
  const [slug, setSlug] = useState(section?.slug || "");
  const [slugTouched, setSlugTouched] = useState(isEdit);
  const [subNavLabel, setSubNavLabel] = useState(section?.sub_nav_label || "");
  const [addPlaceholder, setAddPlaceholder] = useState(section?.add_placeholder || "");
  const [emptyMessage, setEmptyMessage] = useState(section?.empty_message || "");
  const [supportsPairing, setSupportsPairing] = useState(section?.supports_pairing ?? false);
  const [hasMap, setHasMap] = useState(section?.has_map ?? true);
  const [supportsRatings, setSupportsRatings] = useState(section?.supports_ratings ?? false);
  const [cardLayout, setCardLayout] = useState<Section["card_layout"]>(section?.card_layout ?? "list");
  const [navGroupId, setNavGroupId] = useState(section?.nav_group_id || navGroups[0]?.id || "");
  const [newGroupLabel, setNewGroupLabel] = useState("");
  const [fields, setFields] = useState<FieldRow[]>((section?.field_defs || []).map(fieldDefToRow));
  const [addCounterpart, setAddCounterpart] = useState(false);
  const [counterpartLabel, setCounterpartLabel] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  function handleLabelChange(v: string) {
    setLabel(v);
    if (!slugTouched) setSlug(slugify(v));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");

    for (const f of fields) {
      if (!f.key.trim() || !f.label.trim()) {
        setError("Every field needs both a key and a label.");
        return;
      }
    }

    setSaving(true);
    const payload: Record<string, unknown> = {
      label,
      subNavLabel: subNavLabel || label,
      addPlaceholder,
      emptyMessage,
      supportsPairing,
      hasMap,
      supportsRatings,
      cardLayout,
      fieldDefs: fields.map(rowToFieldDef),
    };
    if (!isEdit) {
      payload.slug = slug;
      if (newGroupLabel.trim()) payload.newNavGroupLabel = newGroupLabel.trim();
      else payload.navGroupId = navGroupId;
    } else {
      payload.navGroupId = navGroupId;
    }

    try {
      const url = isEdit
        ? `/api/trips/${trip.slug}/sections/${currentNavGroupSlug}/${section!.slug}`
        : `/api/trips/${trip.slug}/sections`;
      const res = await fetch(url, {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong");

      // Create the "already visited/done" counterpart in the SAME nav
      // group the primary section just landed in (reusing its
      // nav_group_id rather than resolving newNavGroupLabel a second
      // time, which would create a duplicate group) — same fields, but
      // never pairing/map/ratings (see below).
      if (!isEdit && addCounterpart) {
        const counterpartPayload = {
          slug: `${slug}-visited`,
          label: counterpartLabel || `Previously Visited ${label}`,
          subNavLabel: "Previously Visited",
          addPlaceholder: `Paste a link for a ${label.toLowerCase()} you've already been to...`,
          emptyMessage: `No previous ${label.toLowerCase()} yet — paste a link above.`,
          // A "previous"/already-decided list never needs pairing, a map,
          // or ratings, regardless of what the primary section is set to.
          supportsPairing: false,
          hasMap: false,
          supportsRatings: false,
          cardLayout,
          navGroupId: data.section.nav_group_id,
          fieldDefs: fields.map(rowToFieldDef),
        };
        const counterpartRes = await fetch(`/api/trips/${trip.slug}/sections`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(counterpartPayload),
        });
        const counterpartData = await counterpartRes.json();
        if (!counterpartRes.ok) {
          throw new Error(`Created "${label}", but its counterpart failed: ${counterpartData.error || "unknown error"}`);
        }
      }

      router.push(`/${trip.slug}/admin/sections`);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className={styles["form"]}>
      {error && <p className={styles["error"]}>{error}</p>}

      <div className={styles["grid"]}>
        <label className={styles["field"]}>
          Label
          <input required value={label} onChange={(e) => handleLabelChange(e.target.value)} className={styles["input"]} />
        </label>
        <label className={styles["field"]}>
          URL slug
          <input
            required
            disabled={isEdit}
            value={slug}
            onChange={(e) => {
              setSlugTouched(true);
              setSlug(e.target.value);
            }}
            className={styles["input"]}
          />
        </label>
        <label className={styles["field"]}>
          Sub-nav label (optional)
          <input
            value={subNavLabel}
            onChange={(e) => setSubNavLabel(e.target.value)}
            placeholder={label}
            className={styles["input"]}
          />
        </label>

        {isEdit ? (
          <label className={styles["field"]}>
            Nav group
            <select value={navGroupId} onChange={(e) => setNavGroupId(e.target.value)} className={styles["input"]}>
              {navGroups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.label}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <div className={styles["field"]}>
            <label>Nav group</label>
            <div className={styles["nav-group-row"]}>
              <select
                value={newGroupLabel ? "" : navGroupId}
                onChange={(e) => {
                  setNavGroupId(e.target.value);
                  setNewGroupLabel("");
                }}
                disabled={!!newGroupLabel}
                className={styles["nav-group-select"]}
              >
                {navGroups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.label}
                  </option>
                ))}
              </select>
              <input
                value={newGroupLabel}
                onChange={(e) => setNewGroupLabel(e.target.value)}
                placeholder="or new group..."
                className={styles["nav-group-input"]}
              />
            </div>
          </div>
        )}

        <label className={styles["wide-field"]}>
          Add-form placeholder text
          <input
            value={addPlaceholder}
            onChange={(e) => setAddPlaceholder(e.target.value)}
            placeholder="Paste a link..."
            className={styles["input"]}
          />
        </label>
        <label className={styles["wide-field"]}>
          Empty-list message
          <input
            value={emptyMessage}
            onChange={(e) => setEmptyMessage(e.target.value)}
            placeholder="Nothing here yet — paste a link above."
            className={styles["input"]}
          />
        </label>

        <SectionOptionsFields
          supportsPairing={supportsPairing}
          onSupportsPairingChange={setSupportsPairing}
          hasMap={hasMap}
          onHasMapChange={setHasMap}
          supportsRatings={supportsRatings}
          onSupportsRatingsChange={setSupportsRatings}
          cardLayout={cardLayout}
          onCardLayoutChange={setCardLayout}
        />
      </div>

      {!isEdit && (
        <CounterpartOption
          addCounterpart={addCounterpart}
          onAddCounterpartChange={setAddCounterpart}
          counterpartLabel={counterpartLabel}
          onCounterpartLabelChange={setCounterpartLabel}
          primaryLabel={label}
        />
      )}

      <FieldDefsEditor fields={fields} onChange={setFields} />

      {isEdit && section && currentNavGroupSlug && looksLikePastTier(section) && (
        <PrefillPanel
          tripSlug={trip.slug}
          navGroupSlug={currentNavGroupSlug}
          sectionSlug={section.slug}
          sectionId={section.id}
        />
      )}

      <div className={styles["actions"]}>
        <button type="submit" disabled={saving} className={styles["submit-button"]}>
          {saving ? "Saving..." : isEdit ? "Save changes" : "Create section"}
        </button>
      </div>
    </form>
  );
}
