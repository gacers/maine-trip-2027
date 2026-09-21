import { redirect } from "next/navigation";
import { canAccessSiteCatalog } from "@/lib/auth";
import { enabledCategoryTabs, getSurfaceCategorySettings } from "@/lib/siteSurfaceSettings";

export const dynamic = "force-dynamic";

export default async function FutureInterestsIndexPage() {
  const canAccess = await canAccessSiteCatalog();
  if (!canAccess) redirect("/");
  const settings = await getSurfaceCategorySettings("future-interests");
  const first = enabledCategoryTabs(settings)[0];
  if (!first) redirect("/future-interests/manage");
  redirect(`/future-interests/${first.slug}`);
}
