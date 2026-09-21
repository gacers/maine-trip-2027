"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import OverviewMap from "@/components/OverviewMap";
import Button from "@/components/Button";
import type { CatalogItem, SectionTier } from "@/lib/catalog";
import type { OverviewPin } from "@/lib/types";
import styles from "./CatalogPage.module.css";

export interface CatalogPageProps {
  categorySlug: string;
  categoryLabel: string;
  initialItems: CatalogItem[];
}

type TierFilter = "all" | SectionTier;

// Cross-trip browse for one category (Stays, Food & Drink, …) — map of
// visible pins, country + Options/Previously-Visited filters, cards
// linking into the source trip section.
export default function CatalogPage({ categoryLabel, initialItems }: CatalogPageProps) {
  const [countryFilter, setCountryFilter] = useState<string>("all");
  const [tierFilter, setTierFilter] = useState<TierFilter>("all");

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
      if (tierFilter !== "all" && item.sectionTier !== tierFilter) return false;
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
        <div className={styles["map-wrap"]}>
          <OverviewMap pins={pins} />
        </div>
      ) : (
        <p className={styles["empty"]}>No mapped places in this filter.</p>
      )}

      {visible.length === 0 ? (
        <p className={styles["empty"]}>No places match these filters.</p>
      ) : (
        <ul className={styles["list"]}>
          {visible.map((item) => (
            <li key={`${item.tripId}-${item.entry.id}`} id={`catalog-${item.entry.id}`} className={styles["card"]}>
              {item.entry.posterImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.entry.posterImage} alt="" className={styles["thumb"]} />
              ) : (
                <div className={styles["thumb-empty"]} />
              )}
              <div className={styles["card-body"]}>
                <div className={styles["card-meta"]}>
                  <span>{item.tripName}</span>
                  {item.country ? <span>· {item.country}</span> : null}
                  <span>· {item.sectionLabel}</span>
                </div>
                <h2 className={styles["card-title"]}>{item.entry.title || "Untitled"}</h2>
                {item.entry.description ? <p className={styles["card-desc"]}>{item.entry.description}</p> : null}
                <div className={styles["card-actions"]}>
                  <Button variant="secondary" size="sm" asChild>
                    <Link href={item.href}>Open in trip</Link>
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
