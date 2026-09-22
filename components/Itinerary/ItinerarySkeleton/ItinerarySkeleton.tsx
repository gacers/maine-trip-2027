import styles from "./ItinerarySkeleton.module.css";

const LANE_STOPS = [3, 2, 3, 1] as const;

/** Week-view shaped placeholder — day pills + horizontal day lanes. */
export default function ItinerarySkeleton() {
  return (
    <div className={styles.root} aria-busy="true" aria-label="Loading itinerary">
      <div className={styles["day-picker"]}>
        {LANE_STOPS.map((_, i) => (
          <div key={i} className={styles["day-pill"]} />
        ))}
      </div>
      <div className={styles.lanes}>
        {LANE_STOPS.map((stopCount, i) => (
          <div key={i} className={styles.lane}>
            <div className={styles["lane-header"]} />
            {Array.from({ length: stopCount }, (_, j) => (
              <div key={j} className={styles.stop}>
                <div className={styles["stop-main"]}>
                  <div className={styles["line-time"]} />
                  <div className={styles["line-title"]} />
                  <div className={styles["line-meta"]} />
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
