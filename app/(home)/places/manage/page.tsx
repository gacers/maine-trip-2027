import { redirect } from "next/navigation";
import { canAccessSiteCatalog } from "@/lib/auth";
import { getFieldDefsForSiteCategory } from "@/lib/siteCategoryFields";
import { SITE_CATEGORIES } from "@/lib/siteCategories";
import { getPlacesSurfaceSettings } from "@/lib/siteSurfaceSettings";
import SiteSurfaceManage from "@/components/SiteSurfaceManage";
import type { FieldDef } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function PlacesManagePage() {
  const canAccess = await canAccessSiteCatalog();
  if (!canAccess) redirect("/");

  const [settings, ...fieldResults] = await Promise.all([
    getPlacesSurfaceSettings(),
    ...SITE_CATEGORIES.map((c) => getFieldDefsForSiteCategory(c.slug)),
  ]);

  const initialFieldsByCategory: Record<string, FieldDef[]> = {};
  SITE_CATEGORIES.forEach((c, i) => {
    initialFieldsByCategory[c.slug] = fieldResults[i];
  });

  return (
    <SiteSurfaceManage
      surface="places"
      title="Manage Places"
      backHref="/places"
      initialFieldsByCategory={initialFieldsByCategory}
      initialEnabledCategories={settings.enabledCategories}
    />
  );
}
