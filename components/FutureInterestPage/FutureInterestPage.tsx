"use client";

import { useEffect, useMemo, useState } from "react";
import classNames from "classnames";
import OverviewMap from "@/components/OverviewMap";
import Button from "@/components/Button";
import FutureInterestAddDialog from "@/components/FutureInterestAddDialog";
import FutureInterestCard from "./FutureInterestCard";
import { useHomeActions } from "@/components/HomeShell/HomeActions";
import type { FutureInterestItem } from "@/lib/futureInterest";
import type { SiteCategorySlug } from "@/lib/siteCategories";
import type { OverviewPin } from "@/lib/types";
import styles from "./FutureInterestPage.module.css";

export interface FutureInterestPageProps {
  categorySlug: SiteCategorySlug;
  categoryLabel: string;
  initialItems: FutureInterestItem[];
}

export default function FutureInterestPage({ categorySlug, categoryLabel, initialItems }: FutureInterestPageProps) {
  const homeActions = useHomeActions();
  const [items, setItems] = useState(initialItems);
  const [countryFilter, setCountryFilter] = useState("all");
  const [showVisited, setShowVisited] = useState(false);
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    setItems(initialItems);
  }, [initialItems]);

  useEffect(() => {
    const setActions = homeActions?.setCategoryActions;
    if (!setActions) return;
    setActions(
      <FutureInterestAddDialog
        categorySlug={categorySlug}
        onAdded={(item) => {
          if (item.category_slug === categorySlug) {
            setItems((prev) => [item, ...prev]);
          }
          setMessage("Added.");
        }}
      />
    );
    return () => setActions(null);
  }, [homeActions?.setCategoryActions, categorySlug]);

  const countries = useMemo(() => {
    const set = new Set<string>();
    for (const item of items) {
      if (item.country) set.add(item.country);
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [items]);

  const visible = useMemo(() => {
    return items.filter((item) => {
      if (!showVisited && item.visited) return false;
      if (countryFilter !== "all" && (item.country || "") !== countryFilter) return false;
      return true;
    });
  }, [items, countryFilter, showVisited]);

  const pins: OverviewPin[] = useMemo(
    () =>
      visible.map((item) => ({
        anchor: `fi-${item.id}`,
        label: item.title,
        lat: item.lat,
        lng: item.lng,
      })),
    [visible]
  );

  async function importFromOptions() {
    setImporting(true);
    setMessage("");
    try {
      const res = await fetch("/api/future-interest/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categorySlug }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Import failed");
      const listRes = await fetch(`/api/future-interest?category=${categorySlug}&includeVisited=1`);
      const listData = await listRes.json();
      if (listRes.ok) setItems(listData.items || []);
      setMessage(data.imported === 0 ? "Nothing new to import." : `Imported ${data.imported}.`);
    } catch (err) {
      setMessage((err as Error).message);
    } finally {
      setImporting(false);
    }
  }

  async function markVisited(id: string) {
    const res = await fetch(`/api/future-interest/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ visited: true }),
    });
    if (!res.ok) return;
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, visited: true } : i)));
  }

  function handleUpdated(item: FutureInterestItem) {
    setItems((prev) => prev.map((i) => (i.id === item.id ? item : i)));
  }

  async function removeItem(id: string) {
    const res = await fetch(`/api/future-interest/${id}`, { method: "DELETE" });
    if (!res.ok) return;
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  const gridClass = categorySlug === "stays" ? styles["grid-2"] : styles["grid-3"];

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
          <label className={styles["check"]}>
            <input type="checkbox" checked={showVisited} onChange={(e) => setShowVisited(e.target.checked)} />
            Show visited
          </label>
          <Button variant="secondary" size="sm" onClick={importFromOptions} disabled={importing}>
            {importing ? "Importing…" : "Bring in from Options"}
          </Button>
        </div>
      </div>
      {message ? <p className={styles["message"]}>{message}</p> : null}

      {pins.some((p) => p.lat != null && p.lng != null) ? (
        <OverviewMap pins={pins} />
      ) : (
        <p className={styles["empty"]}>No mapped places in this filter.</p>
      )}

      {visible.length === 0 ? (
        <p className={styles["empty"]}>
          Nothing here yet — use + Add in the nav, or bring in unvisited Options from your trips.
        </p>
      ) : (
        <ul className={classNames(styles["list"], gridClass)}>
          {visible.map((item) => (
            <li key={item.id}>
              <FutureInterestCard
                item={item}
                categorySlug={categorySlug}
                onUpdated={handleUpdated}
                onMarkVisited={markVisited}
                onRemove={removeItem}
              />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
