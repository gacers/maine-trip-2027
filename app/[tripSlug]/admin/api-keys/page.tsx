import { notFound } from "next/navigation";
import { getTripBySlug } from "@/lib/sections";
import ApiKeysManager from "@/components/admin/ApiKeysManager";
import AccessManager from "@/components/admin/AccessManager";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

export default async function ApiKeysPage({ params }: { params: Promise<{ tripSlug: string }> }) {
  const { tripSlug } = await params;
  const trip = await getTripBySlug(tripSlug);
  if (!trip) notFound();

  return (
    <div className={styles["root"]}>
      <div className={styles["section"]}>
        <h1 className={styles["heading"]}>Access</h1>
        <p className={styles["intro"]}>
          Everyone who can currently add or edit things here, and one button to cut all of it off at once.
        </p>
        <AccessManager trip={trip} />
      </div>

      <div className={styles["divider"]}>
        <h1 className={styles["heading"]}>API Keys</h1>
        <p className={styles["intro"]}>
          Used by Claude Desktop (or any other automation) to add/edit entries in this trip without signing in —
          see docs/claude-desktop-add-prompts.md for how to wire one up.
        </p>
        <ApiKeysManager trip={trip} />
      </div>
    </div>
  );
}
