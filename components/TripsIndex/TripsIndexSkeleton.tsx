import styles from "./TripsIndexSkeleton.module.css";

/** Trip-card shaped placeholders — no map (unlike surface catalog skeletons).
 * A heading-shaped bar sits above the grid, matching AccessibleTripsIndex's
 * own "Pending Trips" heading in that same spot, so loading doesn't jump
 * the grid down a line once the real heading appears. */
export default function TripsIndexSkeleton() {
  return (
    <main className={styles["root"]} aria-busy="true" aria-label="Loading trips">
      <div className={styles["trip-section"]}>
        <div className={styles["heading-placeholder"]} />
        <div className={styles["trip-grid"]}>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className={styles["card"]}>
              <div className={styles["photo"]} />
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
