import { redirect } from "next/navigation";
import { getAdminUser } from "@/lib/auth";
import { getAppSettings } from "@/lib/settings";
import SettingsForm from "@/components/admin/SettingsForm";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await getAdminUser();
  if (!user) redirect("/login?next=/settings");

  const settings = await getAppSettings();

  return (
    <main className={styles["root"]}>
      <h1 className={styles["heading"]}>Settings</h1>
      <SettingsForm settings={settings} />
    </main>
  );
}
