import { redirect } from "next/navigation";
import { getAdminUser } from "@/lib/auth";
import { getAppSettings } from "@/lib/settings";
import SettingsForm from "@/components/admin/SettingsForm";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await getAdminUser();
  if (!user) redirect("/login?next=/settings");

  const settings = await getAppSettings();

  return (
    <main className="max-w-lg mx-auto px-4 py-12 flex flex-col gap-6 w-full">
      <h1 className="text-2xl font-bold text-zinc-900 text-center">Settings</h1>
      <SettingsForm settings={settings} />
    </main>
  );
}
