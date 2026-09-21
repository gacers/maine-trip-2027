import styles from "./SurfacePageSkeleton.module.css";

export interface SurfacePageSkeletonProps {
  /** Approximate card count for the placeholder grid. */
  cards?: number;
}

/** Route-level loading placeholder for Categories / Places / Future Interests. */
export default function SurfacePageSkeleton({ cards = 6 }: SurfacePageSkeletonProps) {
  return (
    <div className={styles["root"]} aria-busy="true" aria-label="Loading">
      <div className={styles["toolbar"]}>
        <div className={styles["heading"]} />
        <div className={styles["filter"]} />
      </div>
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
