"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import OverviewMap from "@/components/OverviewMap";
import Button from "@/components/Button";
import { assignBadgeVariants, type BadgeVariant } from "@/components/Badge";
import BadgesRow, { type BadgeItem } from "@/components/BadgesRow";
import type { CatalogItem, SectionTier } from "@/lib/catalog";
import type { FieldDef, OverviewPin } from "@/lib/types";
import styles from "./CatalogPage.module.css";

export interface CatalogPageProps {
  categorySlug: string;
  categoryLabel: string;
  initialItems: CatalogItem[];
  /** Boolean type labels (Restaurant, Bar, …) for badge pills. */
  fieldDefs?: FieldDef[];
}

type TierFilter = "all" | SectionTier;

function catalogStatusBadge(item: CatalogItem): BadgeItem {
  if (item.tiers.includes("previously-visited") || item.entry.visited) {
    return { key: "status-visited", label: "Visited", variant: "neutral" };
  }
  return { key: "status-option", label: "Option", variant: "teal" };
}

function catalogTypeBadges(
  item: CatalogItem,
  fieldDefs: FieldDef[],
  badgeVariants: Record<string, BadgeVariant>
): BadgeItem[] {
  const booleanDefs = fieldDefs.filter((f) => f.field_type === "boolean");
  const items: BadgeItem[] = [];
  const known = new Set<string>();
  for (const f of booleanDefs) {
    known.add(f.key);
    const value = item.entry[f.key];
    if (value !== true && value !== "true") continue;
    items.push({
      key: f.key,
      label: f.label,
      variant: f.key === "closed" ? "closed" : badgeVariants[f.key],
    });
  }
  for (const [key, value] of Object.entries(item.entry)) {
    if (known.has(key) || key === "visited") continue;
    if (value !== true && value !== "true") continue;
    if (typeof value !== "boolean" && value !== "true") continue;
    items.push({
      key,
      label: key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      variant: badgeVariants[key] ?? "neutral",
    });
  }
  return items;
}

function catalogBadges(
  item: CatalogItem,
  fieldDefs: FieldDef[],
  badgeVariants: Record<string, BadgeVariant>
): BadgeItem[] {
  return [catalogStatusBadge(item), ...catalogTypeBadges(item, fieldDefs, badgeVariants)];
}

// Cross-trip browse for one category (Stays, Food & Drink, …) — map of
// visible pins, country + Options/Previously-Visited filters, cards for
// original entries only (synced copies listed as trips on the card).
export default function CatalogPage({ categoryLabel, initialItems, fieldDefs = [] }: CatalogPageProps) {
  const [countryFilter, setCountryFilter] = useState<string>("all");
  const [tierFilter, setTierFilter] = useState<TierFilter>("all");

  const badgeVariants = useMemo(
    () =>
      assignBadgeVariants(
        fieldDefs.filter((f) => f.field_type === "boolean" && f.key !== "closed").map((f) => f.key)
      ),
    [fieldDefs]
  );

  const countries = useMemo(() => {
    const set = new Set<string>();
    for (const item of initialItems) {
      if (item.country) set.add(item.country);
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [initialItems]);

  const visible = useMemo(() => {
    return initialItems.filter((item) => {
      if (countryFilter !== "all" && (item.country || "") !== countryFilter) return false;
      if (tierFilter !== "all" && !item.tiers.includes(tierFilter)) return false;
      return true;
    });
  }, [initialItems, countryFilter, tierFilter]);

  const pins: OverviewPin[] = useMemo(
    () =>
      visible.map((item) => ({
        anchor: `catalog-${item.entry.id}`,
        label: item.entry.title,
        lat: item.entry.lat,
        lng: item.entry.lng,
      })),
    [visible]
  );

  return (
    <main className={styles["root"]}>
      <div className={styles["toolbar"]}>
        <h1 className={styles["heading"]}>{categoryLabel}</h1>
        <div className={styles["filters"]}>
          <label className={styles["filter"]}>
            Country
            <select value={countryFilter} onChange={(e) => setCountryFilter(e.target.value)} className={styles["select"]}>
              <option value="all">All</option>
              {countries.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label className={styles["filter"]}>
            Section
            <select
              value={tierFilter}
              onChange={(e) => setTierFilter(e.target.value as TierFilter)}
              className={styles["select"]}
            >
              <option value="all">All</option>
              <option value="options">Options</option>
              <option value="previously-visited">Previously visited</option>
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
        <p className={styles["empty"]}>No places match these filters.</p>
      ) : (
        <ul className={styles["list"]}>
          {visible.map((item) => (
            <li key={item.entry.id} id={`catalog-${item.entry.id}`} className={styles["card"]}>
              {item.entry.posterImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.entry.posterImage} alt="" className={styles["thumb"]} />
              ) : (
                <div className={styles["thumb-empty"]} />
              )}
              <div className={styles["card-body"]}>
                <BadgesRow items={catalogBadges(item, fieldDefs, badgeVariants)} />
                <div className={styles["card-meta"]}>
                  {item.country ? <span>{item.country}</span> : null}
                  {item.trips.length > 0 ? (
                    <span className={styles["trips"]}>
                      {item.country ? " · " : null}
                      {item.trips.map((t, i) => (
                        <span key={`${t.tripId}-${t.sectionLabel}`}>
                          {i > 0 ? ", " : null}
                          <Link href={t.href} className={styles["trip-link"]}>
                            {t.tripName}
                          </Link>
                        </span>
                      ))}
                    </span>
                  ) : null}
                </div>
                <h2 className={styles["card-title"]}>{item.entry.title || "Untitled"}</h2>
                {item.entry.description ? <p className={styles["card-desc"]}>{item.entry.description}</p> : null}
                <div className={styles["card-actions"]}>
                  <Button variant="secondary" size="sm" asChild>
                    <Link href={item.href}>Open original</Link>
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
