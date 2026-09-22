import styles from "./TripsIndexSkeleton.module.css";

/** Trip-card shaped placeholders — no map (unlike surface catalog skeletons). */
export default function TripsIndexSkeleton() {
  return (
    <main className={styles["root"]} aria-busy="true" aria-label="Loading trips">
      <div className={styles["trip-grid"]}>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className={styles["card"]}>
            <div className={styles["photo"]} />
          </div>
        ))}
      </div>
    </main>
  );
}
