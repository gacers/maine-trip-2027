"use client";

import { useEffect, useMemo, useState } from "react";
import classNames from "classnames";
import { useQueryClient } from "@tanstack/react-query";
import OverviewMap from "@/components/OverviewMap";
import PlacesAddDialog from "@/components/PlacesAddDialog";
import type { AddedFieldPayload } from "@/components/AddFieldSelect";
import PlaceCard from "./PlaceCard";
import EmptyState from "@/components/EmptyState";
import { useHomeActions } from "@/components/HomeShell/HomeActions";
import type { PlaceItem } from "@/lib/placesShared";
import type { SiteCategorySlug } from "@/lib/siteCategories";
import type { SurfaceCardLayout } from "@/lib/siteSurfaceShared";
import { defaultCardLayout, defaultSupportsConcerns } from "@/lib/siteSurfaceShared";
import { placesListKey, usePlacesList } from "@/lib/surfaceListQueries";
import type { FieldDef, OverviewPin } from "@/lib/types";
import styles from "./PlacesPage.module.css";

export interface PlacesPageProps {
  categorySlug: SiteCategorySlug;
  categoryLabel: string;
  initialFieldDefs: FieldDef[];
  geocodeTripSlug?: string;
  cardLayout?: SurfaceCardLayout;
  showConcerns?: boolean;
}

export default function PlacesPage({
  categorySlug,
  categoryLabel,
  initialFieldDefs,
  geocodeTripSlug,
  cardLayout = defaultCardLayout(categorySlug),
  showConcerns = defaultSupportsConcerns(categorySlug),
}: PlacesPageProps) {
  const homeActions = useHomeActions();
  const queryClient = useQueryClient();
  const { items, error } = usePlacesList(categorySlug);
  const [fieldDefs, setFieldDefs] = useState(initialFieldDefs);
  const [countryFilter, setCountryFilter] = useState("all");

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
      <PlacesAddDialog
        categorySlug={categorySlug}
        fieldDefs={fieldDefs}
        onFieldDefsChanged={handleFieldDefsChanged}
        showConcerns={showConcerns}
        onAdded={(item) => {
          if (item.category_slug !== categorySlug) return;
          queryClient.setQueryData<PlaceItem[]>(placesListKey(categorySlug), (old) => [
            item,
            ...(old ?? []),
          ]);
        }}
      />
    );
  }, [homeActions?.setCategoryActions, categorySlug, fieldDefs, showConcerns, queryClient]);

  // Don't clear on unmount — sibling tab mounts replace the dialog.
  // HomeShell clears when leaving Places / Future Interests entirely.

  const countries = useMemo(() => {
    const set = new Set<string>();
    for (const item of items) {
      if (item.country) set.add(item.country);
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [items]);

  const visible = useMemo(() => {
    return items.filter((item) => {
      if (countryFilter !== "all" && (item.country || "") !== countryFilter) return false;
      return true;
    });
  }, [items, countryFilter]);

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

  function handleUpdated(item: PlaceItem) {
    queryClient.setQueryData<PlaceItem[]>(placesListKey(categorySlug), (old) =>
      old?.map((i) => (i.id === item.id ? item : i))
    );
  }

  async function removeItem(id: string) {
    const res = await fetch(`/api/places/${id}`, { method: "DELETE" });
    if (!res.ok) return;
    queryClient.setQueryData<PlaceItem[]>(placesListKey(categorySlug), (old) =>
      old?.filter((i) => i.id !== id)
    );
  }

  const layoutClass =
    cardLayout === "grid-3"
      ? styles["grid-3"]
      : cardLayout === "grid-2"
        ? styles["grid-2"]
        : styles["list-layout"];

  if (error) {
    return (
      <main className={styles["root"]}>
        <div className={styles["toolbar"]}>
          <h1 className={styles["heading"]}>{categoryLabel}</h1>
        </div>
        <p className={styles["empty"]}>{error}</p>
      </main>
    );
  }

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

      {error ? <p className={styles["empty"]}>{error}</p> : null}

      {pins.some((p) => p.lat != null && p.lng != null) ? (
        <OverviewMap pins={pins} />
      ) : (
        <p className={styles["empty"]}>No mapped places in this filter.</p>
      )}

      {visible.length === 0 ? (
        <EmptyState>Nothing here yet</EmptyState>
      ) : (
        <ul className={classNames(styles["list"], layoutClass)}>
          {visible.map((item) => (
            <li key={item.id}>
              <PlaceCard
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
