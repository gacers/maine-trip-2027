import styles from "./HomeShellSkeleton.module.css";

// Stands in for SiteStackNav (Trips | Categories | Places | Future
// Interests) while HomeShellBootstrap's own /api/home-shell fetch is
// still pending — every page under this shell an admin (the only
// visitor who ever sees the real bar — see HomeShell's own isAdmin
// gate) actually lands on has one, so reserving its height up front
// avoids the whole page's content jumping down the moment the real bar
// pops in. Sized to roughly match SiteStackNav's own nav-row (same
// padding here), not pixel-perfect — close enough that nothing visibly
// shifts once the real tabs replace these.
export default function HomeShellSkeleton() {
  return (
    <div className={styles["root"]} aria-hidden="true">
      <div className={styles["nav-row"]}>
        <div className={styles["pill"]} style={{ width: "3.25rem" }} />
        <div className={styles["pill"]} style={{ width: "5.5rem" }} />
        <div className={styles["pill"]} style={{ width: "4rem" }} />
        <div className={styles["pill"]} style={{ width: "7.5rem" }} />
      </div>
    </div>
  );
}
