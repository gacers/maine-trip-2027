"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Button from "@/components/Button";
import FieldDefsEditor, {
  fieldDefToRow,
  rowToFieldDef,
  type FieldRow,
} from "@/components/admin/SectionForm/FieldDefsEditor";
import { SITE_CATEGORIES, type SiteCategorySlug } from "@/lib/siteCategories";
import {
  SURFACE_DEFAULT_CATEGORIES,
  type SurfaceCategory,
} from "@/lib/siteSurfaceSettings";
import type { FieldDef } from "@/lib/types";
import styles from "./SiteSurfaceManage.module.css";

export interface SiteSurfaceManageProps {
  surface: "categories" | "future-interests" | "places";
  title: string;
  backHref: string;
  initialFieldsByCategory: Record<string, FieldDef[]>;
  /** Places / Future Interests — configured categories (like trip sections). */
  initialCategories?: SurfaceCategory[];
}

const EDITABLE_CATEGORIES: SiteCategorySlug[] = ["food-drink", "activities"];

interface CustomTemplateOption {
  slug: string;
  label: string;
}

export default function SiteSurfaceManage({
  surface,
  title,
  backHref,
  initialFieldsByCategory,
  initialCategories,
}: SiteSurfaceManageProps) {
  const router = useRouter();
  const showCategoryManage = surface === "places" || surface === "future-interests";
  const [activeCategory, setActiveCategory] = useState<SiteCategorySlug>("food-drink");
  const [rowsByCategory, setRowsByCategory] = useState<Record<string, FieldRow[]>>(() => {
    const init: Record<string, FieldRow[]> = {};
    for (const c of SITE_CATEGORIES) {
      init[c.slug] = (initialFieldsByCategory[c.slug] || []).map(fieldDefToRow);
    }
    return init;
  });
  const [categories, setCategories] = useState<SurfaceCategory[]>(initialCategories ?? []);
  const [customTemplates, setCustomTemplates] = useState<CustomTemplateOption[]>([]);
  const [busySlug, setBusySlug] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!showCategoryManage) return;
    fetch("/api/section-templates", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        const templates = (data.templates || []) as { template_key: string; nav_group_label: string }[];
        setCustomTemplates(
          templates.map((t) => ({
            slug: t.template_key,
            label: t.nav_group_label,
          }))
        );
      })
      .catch(() => {});
  }, [showCategoryManage]);

  const existingSlugs = new Set(categories.map((c) => c.slug));

  async function apiAction(body: Record<string, unknown>) {
    const res = await fetch("/api/site-surface-settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ surface, ...body }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Update failed");
    setCategories(data.settings.categories);
    router.refresh();
    return data.settings;
  }

  async function addCategory(slug: string, label: string) {
    setBusySlug(slug);
    setMessage("");
    setError("");
    try {
      await apiAction({ action: "add", slug, label });
      setMessage(`Added ${label}.`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusySlug(null);
    }
  }

  async function toggleEnabled(slug: string, enabled: boolean) {
    setBusySlug(slug);
    setMessage("");
    setError("");
    try {
      await apiAction({ action: "setEnabled", slug, enabled });
      setMessage(enabled ? `Enabled ${slug}.` : `Disabled ${slug} — data kept; re-enable anytime.`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusySlug(null);
    }
  }

  async function removeCategory(cat: SurfaceCategory) {
    const noun = surface === "places" ? "places" : "future interest items";
    if (
      !window.confirm(
        `Permanently remove "${cat.label}" from this surface and delete every ${noun} in it? This can't be undone.`
      )
    ) {
      return;
    }
    setBusySlug(cat.slug);
    setMessage("");
    setError("");
    try {
      await apiAction({ action: "remove", slug: cat.slug });
      setMessage(`Removed ${cat.label}.`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusySlug(null);
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
      ? "Enabled = show in nav and sync Options. Disabled = hide + pause sync (data kept). Remove = delete this category's items."
      : "Enabled = show in nav. Disabled = hide (data kept). Remove = delete this category's places.";

  return (
    <main className={styles["root"]}>
      <div className={styles["toolbar"]}>
        <div>
          <p className={styles["eyebrow"]}>
            <Link href={backHref}>← Back</Link>
          </p>
          <h1 className={styles["heading"]}>{title}</h1>
          <p className={styles["lede"]}>
            {showCategoryManage
              ? "Same idea as trip Manage: add categories from defaults or other trips, enable/disable, or remove."
              : "Edit shared type fields used on catalog badges and trip sections."}
          </p>
        </div>
      </div>

      {message ? <p className={styles["message"]}>{message}</p> : null}
      {error ? <p className={styles["error"]}>{error}</p> : null}

      {showCategoryManage ? (
        <>
          <section className={styles["section"]}>
            <h2 className={styles["section-title"]}>Add from a template</h2>
            <p className={styles["hint"]}>
              Defaults match trip starters. Customs are nav groups built on other trips.
            </p>
            <div className={styles["template-subheading"]}>Defaults</div>
            <div className={styles["template-list"]}>
              {SURFACE_DEFAULT_CATEGORIES.map((t) => {
                const exists = existingSlugs.has(t.slug);
                return (
                  <button
                    key={t.slug}
                    type="button"
                    disabled={exists || busySlug === t.slug}
                    className={styles["template-button"]}
                    onClick={() => addCategory(t.slug, t.label)}
                  >
                    {exists ? `${t.label} ✓` : busySlug === t.slug ? "Adding…" : `+ ${t.label}`}
                  </button>
                );
              })}
            </div>
            {customTemplates.length > 0 ? (
              <>
                <div className={styles["template-subheading"]}>
                  Custom{" "}
                  <span className={styles["template-subheading-hint"]}>— built on another trip, reusable here</span>
                </div>
                <div className={styles["template-list"]}>
                  {customTemplates.map((t) => {
                    const exists = existingSlugs.has(t.slug);
                    return (
                      <button
                        key={t.slug}
                        type="button"
                        disabled={exists || busySlug === t.slug}
                        className={styles["template-button"]}
                        onClick={() => addCategory(t.slug, t.label)}
                      >
                        {exists ? `${t.label} ✓` : busySlug === t.slug ? "Adding…" : `+ ${t.label}`}
                      </button>
                    );
                  })}
                </div>
              </>
            ) : null}
          </section>

          <section className={styles["section"]}>
            <h2 className={styles["section-title"]}>Categories</h2>
            <p className={styles["hint"]}>{categoryHint}</p>
            {categories.length === 0 ? (
              <p className={styles["hint"]}>Nothing added yet — pick a template above.</p>
            ) : (
              <ul className={styles["section-list"]}>
                {categories.map((c) => (
                  <li
                    key={c.slug}
                    className={c.enabled ? styles["section-card"] : styles["section-card-disabled"]}
                  >
                    <div className={styles["section-label-row"]}>
                      <span className={styles["section-label"]}>{c.label}</span>
                      {!c.enabled ? <span className={styles["section-meta"]}>· disabled</span> : null}
                    </div>
                    <div className={styles["section-actions"]}>
                      <label className={styles["enabled-checkbox-label"]}>
                        <input
                          type="checkbox"
                          checked={c.enabled}
                          disabled={busySlug === c.slug}
                          onChange={(e) => toggleEnabled(c.slug, e.target.checked)}
                          className={styles["enabled-checkbox"]}
                        />
                        Enabled
                      </label>
                      {c.enabled ? (
                        <Link href={`/${surface}/${c.slug}`} className={styles["edit-link"]}>
                          Open
                        </Link>
                      ) : null}
                      <button
                        type="button"
                        className={styles["remove-link"]}
                        disabled={busySlug === c.slug}
                        onClick={() => removeCategory(c)}
                      >
                        Remove
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
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
