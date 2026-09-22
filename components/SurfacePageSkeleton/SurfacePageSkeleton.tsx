import classNames from "classnames";
import styles from "./SurfacePageSkeleton.module.css";

export interface SurfacePageSkeletonProps {
  /** Approximate card count for the placeholder grid. */
  cards?: number;
  /**
   * `page` — full placeholder including fake toolbar (legacy / unused).
   * `content` — map + cards only, under the real page chrome.
   */
  variant?: "page" | "content";
  className?: string;
}

/** Loading placeholder for Categories / Places / Future Interests (and similar lists). */
export default function SurfacePageSkeleton({
  cards = 6,
  variant = "content",
  className,
}: SurfacePageSkeletonProps) {
  return (
    <div
      className={classNames(variant === "page" ? styles["root"] : styles["content"], className)}
      aria-busy="true"
      aria-label="Loading"
    >
      {variant === "page" ? (
        <div className={styles["toolbar"]}>
          <div className={styles["heading"]} />
          <div className={styles["filter"]} />
        </div>
      ) : null}
      <div className={styles["map"]} />
      <ul className={styles["grid"]}>
        {Array.from({ length: cards }, (_, i) => (
          <li key={i} className={styles["card"]}>
            <div className={styles["thumb"]} />
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
