import { redirect } from "next/navigation";
import { getAdminUser, isSuperAdminUser } from "@/lib/auth";
import { getAppSettings } from "@/lib/settings";
import SettingsForm from "@/components/admin/SettingsForm";
import GoogleConnectionsPanel from "@/components/admin/GoogleConnectionsPanel";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await getAdminUser();
  if (!user) redirect("/login?next=/settings");

  const [settings, isSuperAdmin] = await Promise.all([getAppSettings(), isSuperAdminUser(user)]);

  return (
    <main className={styles["root"]}>
      <h1 className={styles["heading"]}>Settings</h1>
      <SettingsForm settings={settings} />
      {/* Credential rotation is super-admin-only (see requireSuperAdmin
          on its own API routes) — hidden here too rather than shown to
          a regular admin only to 403 the moment they click anything. */}
      {isSuperAdmin && <GoogleConnectionsPanel />}
    </main>
  );
}
