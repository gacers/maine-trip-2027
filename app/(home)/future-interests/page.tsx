import { redirect } from "next/navigation";
import { canAccessSiteCatalog } from "@/lib/auth";
import { getSurfaceCategorySettings } from "@/lib/siteSurfaceSettings";
import { SITE_CATEGORIES } from "@/lib/siteCategories";

export const dynamic = "force-dynamic";

export default async function FutureInterestsIndexPage() {
  const canAccess = await canAccessSiteCatalog();
  if (!canAccess) redirect("/");
  const settings = await getSurfaceCategorySettings("future-interests");
  const first = settings.enabledCategories[0];
  if (!first) redirect("/future-interests/manage");
  redirect(`/future-interests/${first}`);
}
