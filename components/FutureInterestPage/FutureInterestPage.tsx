"use client";

import { useEffect, useMemo, useState } from "react";
import classNames from "classnames";
import OverviewMap from "@/components/OverviewMap";
import FutureInterestAddDialog from "@/components/FutureInterestAddDialog";
import type { AddedFieldPayload } from "@/components/AddFieldSelect";
import FutureInterestCard from "./FutureInterestCard";
import { useHomeActions } from "@/components/HomeShell/HomeActions";
import type { FutureInterestViewItem } from "@/lib/futureInterest";
import type { SiteCategorySlug } from "@/lib/siteCategories";
import type { SurfaceCardLayout } from "@/lib/siteSurfaceShared";
import { defaultCardLayout, defaultSupportsConcerns } from "@/lib/siteSurfaceShared";
import type { FieldDef, OverviewPin } from "@/lib/types";
import styles from "./FutureInterestPage.module.css";

export interface FutureInterestPageProps {
  categorySlug: SiteCategorySlug;
  categoryLabel: string;
  initialItems: FutureInterestViewItem[];
  initialFieldDefs: FieldDef[];
  /** Trip slug for EntryCard geocode lookups (admin session). */
  geocodeTripSlug?: string;
  cardLayout?: SurfaceCardLayout;
  showConcerns?: boolean;
}

export default function FutureInterestPage({
  categorySlug,
  categoryLabel,
  initialItems,
  initialFieldDefs,
  geocodeTripSlug,
  cardLayout = defaultCardLayout(categorySlug),
  showConcerns = defaultSupportsConcerns(categorySlug),
}: FutureInterestPageProps) {
  const homeActions = useHomeActions();
  const [items, setItems] = useState(initialItems);
  const [fieldDefs, setFieldDefs] = useState(initialFieldDefs);
  const [countryFilter, setCountryFilter] = useState("all");

  useEffect(() => {
    setItems(initialItems);
  }, [initialItems]);

  useEffect(() => {
    setFieldDefs(initialFieldDefs);
  }, [initialFieldDefs]);

  function handleFieldDefsChanged(field: AddedFieldPayload) {
    setFieldDefs((prev) => {
      if (prev.some((f) => f.key === field.key)) return prev;
      return [
        ...prev,
        {
          id: field.key,
          section_id: "",
          key: field.key,
          label: field.label,
          field_type: field.fieldType,
          storage: "jsonb",
          core_column: null,
          options: field.options || null,
          sort_order: prev.length,
          show_on_overview: field.showOnOverview,
          required: field.required,
        },
      ];
    });
  }

  useEffect(() => {
    const setActions = homeActions?.setCategoryActions;
    if (!setActions) return;
    setActions(
      <FutureInterestAddDialog
        categorySlug={categorySlug}
        fieldDefs={fieldDefs}
        onFieldDefsChanged={handleFieldDefsChanged}
        showConcerns={showConcerns}
        onAdded={(item) => {
          if (item.category_slug === categorySlug) {
            setItems((prev) => [{ ...item, kind: "manual" as const }, ...prev]);
          }
        }}
      />
    );
  }, [homeActions?.setCategoryActions, categorySlug, fieldDefs, showConcerns]);

  // Clear the nav slot only when leaving this page — not when fieldDefs
  // updates mid-add (that remount closed the dialog after "+ Add field").
  useEffect(() => {
    const setActions = homeActions?.setCategoryActions;
    if (!setActions) return;
    return () => setActions(null);
  }, [homeActions?.setCategoryActions]);

  const countries = useMemo(() => {
    const set = new Set<string>();
    for (const item of items) {
      if (item.country) set.add(item.country);
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [items]);

  const visible = useMemo(() => {
    return items.filter((item) => {
      if (item.visited) return false;
      if (countryFilter !== "all" && (item.country || "") !== countryFilter) return false;
      return true;
    });
  }, [items, countryFilter]);

  // EntryCard anchors are #listing-<id> — match so map pins jump correctly.
  const pins: OverviewPin[] = useMemo(
    () =>
      visible.map((item) => ({
        anchor: `listing-${item.id}`,
        label: item.title,
        lat: item.lat,
        lng: item.lng,
      })),
    [visible]
  );

  function handleUpdated(item: FutureInterestViewItem) {
    if (item.visited) {
      setItems((prev) => prev.filter((i) => i.id !== item.id));
      return;
    }
    setItems((prev) => prev.map((i) => (i.id === item.id ? item : i)));
  }

  async function removeItem(id: string) {
    const existing = items.find((i) => i.id === id);
    if (existing?.kind === "manual") {
      const res = await fetch(`/api/future-interests/${id}`, { method: "DELETE" });
      if (!res.ok) return;
    }
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  const layoutClass =
    cardLayout === "grid-3"
      ? styles["grid-3"]
      : cardLayout === "grid-2"
        ? styles["grid-2"]
        : styles["list-layout"];

  return (
    <main className={styles["root"]}>
      <div className={styles["toolbar"]}>
        <h1 className={styles["heading"]}>{categoryLabel}</h1>
        <div className={styles["filters"]}>
          <label className={styles["filter"]}>
            Location
            <select value={countryFilter} onChange={(e) => setCountryFilter(e.target.value)} className={styles["select"]}>
              <option value="all">All</option>
              {countries.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {pins.some((p) => p.lat != null && p.lng != null) ? (
        <OverviewMap pins={pins} />
      ) : (
        <p className={styles["empty"]}>No mapped places in this filter.</p>
      )}

      {visible.length === 0 ? (
        <p className={styles["empty"]}>
          Nothing here yet — unvisited Options from your trips show up automatically, or use + Add in the nav.
        </p>
      ) : (
        <ul className={classNames(styles["list"], layoutClass)}>
          {visible.map((item) => (
            <li key={`${item.kind}-${item.id}`}>
              <FutureInterestCard
                item={item}
                categorySlug={categorySlug}
                initialFieldDefs={fieldDefs}
                geocodeTripSlug={geocodeTripSlug}
                cardLayout={cardLayout}
                showConcerns={showConcerns}
                onUpdated={handleUpdated}
                onRemove={removeItem}
              />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
