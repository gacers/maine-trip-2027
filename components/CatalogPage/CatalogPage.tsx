"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import OverviewMap from "@/components/OverviewMap";
import Button from "@/components/Button";
import BadgesRow, { Badge, assignBadgeVariants, type BadgeItem, type BadgeVariant } from "@/components/BadgesRow";
import FramedCard from "@/components/FramedCard";
import Image from "@/components/Image";
import type { CatalogItem, SectionTier } from "@/lib/catalog";
import {
  isStatusBooleanKey,
  orderBooleanBadgeFields,
  statusBadgeVariant,
} from "@/lib/statusFields";
import type { SurfaceCardLayout } from "@/lib/siteSurfaceShared";
import { defaultCardLayout } from "@/lib/siteSurfaceShared";
import { useCatalogList } from "@/lib/surfaceListQueries";
import EmptyState from "@/components/EmptyState";
import type { FieldDef, OverviewPin } from "@/lib/types";
import styles from "./CatalogPage.module.css";

export interface CatalogPageProps {
  categorySlug: string;
  categoryLabel: string;
  /** Boolean type labels (Restaurant, Bar, …) for badge pills. */
  fieldDefs?: FieldDef[];
  cardLayout?: SurfaceCardLayout;
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
  const booleanDefs = orderBooleanBadgeFields(fieldDefs.filter((f) => f.field_type === "boolean"));
  const items: BadgeItem[] = [];
  const known = new Set<string>();
  for (const f of booleanDefs) {
    known.add(f.key);
    const value = item.entry[f.key];
    if (value !== true && value !== "true") continue;
    items.push({
      key: f.key,
      label: f.label,
      variant: statusBadgeVariant(f.key) ?? badgeVariants[f.key],
    });
  }
  // Global Closed/Moved even when this category's field list hasn't caught up.
  for (const key of ["closed", "moved"] as const) {
    if (known.has(key)) continue;
    const value = item.entry[key];
    if (value !== true && value !== "true") continue;
    items.push({
      key,
      label: key === "closed" ? "Closed" : "Moved",
      variant: statusBadgeVariant(key) ?? "neutral",
    });
  }
  for (const [key, value] of Object.entries(item.entry)) {
    if (known.has(key) || key === "visited" || isStatusBooleanKey(key)) continue;
    if (value !== true && value !== "true") continue;
    if (typeof value !== "boolean" && value !== "true") continue;
    items.push({
      key,
      label: key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      variant: badgeVariants[key] ?? "neutral",
    });
  }
  return orderBooleanBadgeFields(items);
}

// Cross-trip browse for one category (Stays, Food & Drink, …) — map of
// visible pins, country + Options/Previously-Visited filters, cards for
// original entries only (synced copies listed as trips on the card).
export default function CatalogPage({
  categorySlug,
  categoryLabel,
  fieldDefs = [],
  cardLayout = defaultCardLayout(categorySlug),
}: CatalogPageProps) {
  const { items, error } = useCatalogList(categorySlug);
  const [countryFilter, setCountryFilter] = useState<string>("all");
  const [tierFilter, setTierFilter] = useState<TierFilter>("all");

  const badgeVariants = useMemo(
    () =>
      assignBadgeVariants(
        fieldDefs.filter((f) => f.field_type === "boolean" && !isStatusBooleanKey(f.key)).map((f) => f.key)
      ),
    [fieldDefs]
  );

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
      if (tierFilter !== "all" && !item.tiers.includes(tierFilter)) return false;
      return true;
    });
  }, [items, countryFilter, tierFilter]);

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

  const layoutClass =
    cardLayout === "grid-3"
      ? styles["grid-3"]
      : cardLayout === "grid-2"
        ? styles["grid-2"]
        : styles["list-layout"];
  const thumbClass =
    cardLayout === "grid-3"
      ? styles["thumb-compact"]
      : cardLayout === "grid-2"
        ? styles["thumb-medium"]
        : styles["thumb-large"];
  const thumbSizes =
    cardLayout === "grid-3"
      ? "(max-width: 40rem) 100vw, (max-width: 64rem) 50vw, 33vw"
      : cardLayout === "grid-2"
        ? "(max-width: 40rem) 100vw, 50vw"
        : "(max-width: 40rem) 100vw, 72rem";

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

      {error ? <p className={styles["empty"]}>{error}</p> : null}

      {pins.some((p) => p.lat != null && p.lng != null) ? (
        <OverviewMap pins={pins} />
      ) : (
        <p className={styles["empty"]}>No mapped places in this filter.</p>
      )}

      {visible.length === 0 ? (
        <EmptyState>No places match these filters</EmptyState>
      ) : (
        <ul className={`${styles["list"]} ${layoutClass}`}>
          {visible.map((item) => {
            const status = catalogStatusBadge(item);
            const types = catalogTypeBadges(item, fieldDefs, badgeVariants);
            return (
            <FramedCard as="li" key={item.entry.id} id={`catalog-${item.entry.id}`} className={styles["card"]}>
              {item.entry.posterImage ? (
                <div className={`${styles["thumb"]} ${thumbClass}`}>
                  <Image
                    src={item.entry.posterImage}
                    alt=""
                    fill
                    sizes={thumbSizes}
                  />
                </div>
              ) : (
                <div className={`${styles["thumb-empty"]} ${thumbClass}`} />
              )}
              <div className={styles["card-body"]}>
                <div className={styles["card-heading"]}>
                  <div className={styles["card-tags"]}>
                    <Badge variant={status.variant}>{status.label}</Badge>
                    {types.length > 0 ? (
                      <>
                        <span className={styles["card-tags-dash"]} aria-hidden>
                          -
                        </span>
                        <BadgesRow items={types} />
                      </>
                    ) : null}
                  </div>
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
                </div>
                {item.entry.description ? <p className={styles["card-desc"]}>{item.entry.description}</p> : null}
                <div className={styles["card-actions"]}>
                  <Button variant="secondary" size="sm" asChild>
                    <Link href={item.href}>
                      {item.origin === "future-interests"
                        ? "Open in Future Interests"
                        : item.origin === "places"
                          ? "Open in Places"
                          : "Open original"}
                    </Link>
                  </Button>
                </div>
              </div>
            </FramedCard>
            );
          })}
        </ul>
      )}
    </main>
  );
}
