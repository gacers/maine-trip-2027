import { notFound } from "next/navigation";
import { getTripBySlug } from "@/lib/sections";
import AccessManager from "@/components/admin/AccessManager";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

// API Keys (Claude Desktop/automation — see ApiKeysManager) is hidden
// here for now, not removed: nobody's using it yet and it was crowding
// this page for no real benefit. Bring it back by re-adding
// `<ApiKeysManager trip={trip} />` (its own section, same shape as
// before) whenever that changes — the component and its API routes are
// untouched.
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
    </div>
  );
}
