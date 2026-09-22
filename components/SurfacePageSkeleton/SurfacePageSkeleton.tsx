import classNames from "classnames";
import type { SurfaceCardLayout } from "@/lib/siteSurfaceShared";
import styles from "./SurfacePageSkeleton.module.css";

export interface SurfacePageSkeletonProps {
  /** Match Manage / section card layout so placeholders don't jump. */
  cardLayout?: SurfaceCardLayout;
  /** Override card count (defaults by layout). */
  cards?: number;
  /** Overview map placeholder — matches OverviewMap frame + canvas height. */
  showMap?: boolean;
  /**
   * `surface` — Catalog/Places/FI thumb heights (14 / 10 / 7.5rem).
   * `section` — EntryMedia heights (13 / 15 / 11rem); use with largeMedia for Stays list.
   */
  tone?: "surface" | "section";
  /** Stays list — 20rem EntryMedia photo. */
  largeMedia?: boolean;
  className?: string;
}

function defaultCards(layout: SurfaceCardLayout): number {
  if (layout === "list") return 3;
  if (layout === "grid-2") return 4;
  return 6;
}

/** Loading placeholder for Categories / Places / FI / trip sections. */
export default function SurfacePageSkeleton({
  cardLayout = "grid-3",
  cards,
  showMap = true,
  tone = "surface",
  largeMedia = false,
  className,
}: SurfacePageSkeletonProps) {
  const count = cards ?? defaultCards(cardLayout);
  const gridClass =
    cardLayout === "list"
      ? styles["grid-list"]
      : cardLayout === "grid-2"
        ? styles["grid-2"]
        : styles["grid-3"];

  let thumbClass = styles["thumb-compact"];
  if (tone === "section") {
    if (largeMedia) thumbClass = styles["thumb-section-large"];
    else if (cardLayout === "list") thumbClass = styles["thumb-section"];
    else if (cardLayout === "grid-2") thumbClass = styles["thumb-section-medium"];
    else thumbClass = styles["thumb-section-compact"];
  } else if (cardLayout === "list") {
    thumbClass = styles["thumb-large"];
  } else if (cardLayout === "grid-2") {
    thumbClass = styles["thumb-medium"];
  }

  return (
    <div className={classNames(styles["content"], className)} aria-busy="true" aria-label="Loading">
      {showMap ? (
        <div className={styles["map-frame"]}>
          <div className={styles["map-heading"]} />
          <div className={styles["map-canvas"]} />
          <div className={styles["map-hint"]} />
        </div>
      ) : null}
      <ul className={gridClass}>
        {Array.from({ length: count }, (_, i) => (
          <li key={i} className={styles["card"]}>
            <div className={thumbClass} />
            <div className={styles["card-body"]}>
              <div className={styles["line"]} />
              <div className={styles["line-short"]} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
