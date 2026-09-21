"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
  /**
   * Places / Future Interests — trip-style Enabled toggles for category
   * tabs. Disabled tabs stay listed here so they can be turned back on;
   * FI also skips Options catalog merge while disabled.
   */
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
  const router = useRouter();
  const showCategoryEnable = surface === "places" || surface === "future-interests";
  const [activeCategory, setActiveCategory] = useState<SiteCategorySlug>("food-drink");
  const [rowsByCategory, setRowsByCategory] = useState<Record<string, FieldRow[]>>(() => {
    const init: Record<string, FieldRow[]> = {};
    for (const c of SITE_CATEGORIES) {
      init[c.slug] = (initialFieldsByCategory[c.slug] || []).map(fieldDefToRow);
    }
    return init;
  });
  const [enabledCategories, setEnabledCategories] = useState<SiteCategorySlug[]>(
    initialEnabledCategories ?? SITE_CATEGORIES.map((c) => c.slug)
  );
  const [toggling, setToggling] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function toggleEnabled(slug: SiteCategorySlug, enabled: boolean) {
    setToggling(slug);
    setMessage("");
    setError("");
    const next = enabled
      ? [...new Set([...enabledCategories, slug])]
      : enabledCategories.filter((s) => s !== slug);
    try {
      const res = await fetch("/api/site-surface-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ surface, enabledCategories: next }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Update failed");
      setEnabledCategories(data.settings.enabledCategories);
      setMessage(enabled ? `Enabled ${slug}.` : `Disabled ${slug} — re-enable anytime.`);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setToggling(null);
    }
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

  const categoryHint =
    surface === "future-interests"
      ? "Disabled categories hide from the nav and pause Options auto-sync. Manual items stay; turn Enabled back on anytime."
      : "Disabled categories hide from the nav. Existing places stay; turn Enabled back on anytime.";

  return (
    <main className={styles["root"]}>
      <div className={styles["toolbar"]}>
        <div>
          <p className={styles["eyebrow"]}>
            <Link href={backHref}>← Back</Link>
          </p>
          <h1 className={styles["heading"]}>{title}</h1>
          <p className={styles["lede"]}>
            {showCategoryEnable
              ? "Enable or disable category sections (same idea as trip Manage), and edit shared type fields."
              : "Edit shared type fields used on catalog badges and trip sections."}
          </p>
        </div>
      </div>

      {message ? <p className={styles["message"]}>{message}</p> : null}
      {error ? <p className={styles["error"]}>{error}</p> : null}

      {showCategoryEnable ? (
        <section className={styles["section"]}>
          <h2 className={styles["section-title"]}>Categories</h2>
          <p className={styles["hint"]}>{categoryHint}</p>
          <ul className={styles["section-list"]}>
            {SITE_CATEGORIES.map((c) => {
              const enabled = enabledCategories.includes(c.slug);
              return (
                <li
                  key={c.slug}
                  className={enabled ? styles["section-card"] : styles["section-card-disabled"]}
                >
                  <div className={styles["section-label-row"]}>
                    <span className={styles["section-label"]}>{c.label}</span>
                    {!enabled ? <span className={styles["section-meta"]}>· disabled</span> : null}
                  </div>
                  <div className={styles["section-actions"]}>
                    <label className={styles["enabled-checkbox-label"]}>
                      <input
                        type="checkbox"
                        checked={enabled}
                        disabled={toggling === c.slug}
                        onChange={(e) => toggleEnabled(c.slug, e.target.checked)}
                        className={styles["enabled-checkbox"]}
                      />
                      Enabled
                    </label>
                    {enabled ? (
                      <Link href={`/${surface}/${c.slug}`} className={styles["edit-link"]}>
                        Open
                      </Link>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
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
