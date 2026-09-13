import { getTripBySlug } from "@/lib/sections";
import ApiKeysManager from "@/components/admin/ApiKeysManager";

export const dynamic = "force-dynamic";

export default async function ApiKeysPage({ params }) {
  const { tripSlug } = await params;
  const trip = await getTripBySlug(tripSlug);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-bold text-zinc-900">API Keys</h1>
      <p className="text-sm text-zinc-500">
        Used by Claude Desktop (or any other automation) to add/edit entries in this trip without
        signing in — see docs/claude-desktop-add-prompts.md for how to wire one up.
      </p>
      <ApiKeysManager trip={trip} />
    </div>
  );
}
