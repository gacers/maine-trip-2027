"use client";

import { useState } from "react";
import Link from "next/link";
import Button from "@/components/Button";
import FieldDefsEditor, {
  fieldDefToRow,
  rowToFieldDef,
  type FieldRow,
} from "@/components/admin/SectionForm/FieldDefsEditor";
import { SITE_CATEGORIES, type SiteCategorySlug } from "@/lib/siteCategories";
import type { FieldDef } from "@/lib/types";
import styles from "./SiteSurfaceManage.module.css";

export interface SiteSurfaceManageProps {
  surface: "categories" | "future-interests" | "places";
  title: string;
  backHref: string;
  /** Initial field defs keyed by category slug. */
  initialFieldsByCategory: Record<string, FieldDef[]>;
  /** Places only — which category tabs are enabled. */
  initialEnabledCategories?: SiteCategorySlug[];
}

const EDITABLE_CATEGORIES: SiteCategorySlug[] = ["food-drink", "activities"];

export default function SiteSurfaceManage({
  surface,
  title,
  backHref,
  initialFieldsByCategory,
  initialEnabledCategories,
}: SiteSurfaceManageProps) {
  const [activeCategory, setActiveCategory] = useState<SiteCategorySlug>("food-drink");
  const [rowsByCategory, setRowsByCategory] = useState<Record<string, FieldRow[]>>(() => {
    const init: Record<string, FieldRow[]> = {};
    for (const c of SITE_CATEGORIES) {
      init[c.slug] = (initialFieldsByCategory[c.slug] || []).map(fieldDefToRow);
    }
    return init;
  });
  const [enabledCategories, setEnabledCategories] = useState<SiteCategorySlug[]>(
    initialEnabledCategories || SITE_CATEGORIES.map((c) => c.slug)
  );
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  function toggleCategory(slug: SiteCategorySlug) {
    setEnabledCategories((prev) => {
      if (prev.includes(slug)) {
        if (prev.length <= 1) return prev;
        return prev.filter((s) => s !== slug);
      }
      return [...prev, slug];
    });
  }

  async function saveFields() {
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const rows = rowsByCategory[activeCategory] || [];
      const fields = rows
        .map(rowToFieldDef)
        .filter((f) => f.key && f.label)
        .map((f) => ({
          key: f.key,
          label: f.label,
          fieldType: f.field_type,
          showOnOverview: f.show_on_overview,
          required: f.required,
          options: f.options || null,
        }));

      const res = await fetch("/api/site-category-fields", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categorySlug: activeCategory, fields }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      setRowsByCategory((prev) => ({
        ...prev,
        [activeCategory]: (data.fields as FieldDef[]).map(fieldDefToRow),
      }));
      setMessage(`Saved ${activeCategory} fields.`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function savePlacesTabs() {
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const res = await fetch("/api/places/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabledCategories }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      setEnabledCategories(data.settings.enabledCategories);
      setMessage("Saved Places category tabs.");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className={styles["root"]}>
      <div className={styles["toolbar"]}>
        <div>
          <p className={styles["eyebrow"]}>
            <Link href={backHref}>← Back</Link>
          </p>
          <h1 className={styles["heading"]}>{title}</h1>
          <p className={styles["lede"]}>
            Edit shared type fields used on catalog badges and trip sections
            {surface === "places" ? ", and which category tabs Places shows" : ""}.
          </p>
        </div>
      </div>

      {message ? <p className={styles["message"]}>{message}</p> : null}
      {error ? <p className={styles["error"]}>{error}</p> : null}

      {surface === "places" ? (
        <section className={styles["section"]}>
          <h2 className={styles["section-title"]}>Category tabs</h2>
          <p className={styles["hint"]}>Choose which tabs appear on Places. At least one must stay on.</p>
          <ul className={styles["check-list"]}>
            {SITE_CATEGORIES.map((c) => (
              <li key={c.slug}>
                <label className={styles["check"]}>
                  <input
                    type="checkbox"
                    checked={enabledCategories.includes(c.slug)}
                    onChange={() => toggleCategory(c.slug)}
                  />
                  {c.label}
                </label>
              </li>
            ))}
          </ul>
          <Button variant="primary" size="sm" onClick={savePlacesTabs} disabled={saving}>
            {saving ? "Saving…" : "Save tabs"}
          </Button>
        </section>
      ) : null}

      <section className={styles["section"]}>
        <h2 className={styles["section-title"]}>Type fields</h2>
        <p className={styles["hint"]}>
          Changes apply to every trip section in this category (and Future Interests / Places cards that use them).
        </p>
        <div className={styles["category-tabs"]}>
          {EDITABLE_CATEGORIES.map((slug) => (
            <button
              key={slug}
              type="button"
              className={activeCategory === slug ? styles["tab-active"] : styles["tab"]}
              onClick={() => setActiveCategory(slug)}
            >
              {SITE_CATEGORIES.find((c) => c.slug === slug)?.label || slug}
            </button>
          ))}
        </div>
        <FieldDefsEditor
          fields={rowsByCategory[activeCategory] || []}
          onChange={(fields) => setRowsByCategory((prev) => ({ ...prev, [activeCategory]: fields }))}
        />
        <div className={styles["actions"]}>
          <Button variant="primary" size="sm" onClick={saveFields} disabled={saving}>
            {saving ? "Saving…" : "Save fields"}
          </Button>
        </div>
      </section>
    </main>
  );
}
