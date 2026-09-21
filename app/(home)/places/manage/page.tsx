import { redirect } from "next/navigation";
import { canAccessSiteCatalog } from "@/lib/auth";
import { getFieldDefsForSiteCategory } from "@/lib/siteCategoryFields";
import { SITE_CATEGORIES } from "@/lib/siteCategories";
import { enabledCategoryTabs, getSurfaceCategorySettings } from "@/lib/siteSurfaceSettings";
import SiteSurfaceManage from "@/components/SiteSurfaceManage";
import type { FieldDef } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function PlacesManagePage() {
  const canAccess = await canAccessSiteCatalog();
  if (!canAccess) redirect("/");

  const settings = await getSurfaceCategorySettings("places");
  const firstTab = enabledCategoryTabs(settings)[0];
  const slugs = [
    ...new Set([...SITE_CATEGORIES.map((c) => c.slug), ...settings.categories.map((c) => c.slug)]),
  ];
  const fieldResults = await Promise.all(slugs.map((slug) => getFieldDefsForSiteCategory(slug)));

  const initialFieldsByCategory: Record<string, FieldDef[]> = {};
  slugs.forEach((slug, i) => {
    initialFieldsByCategory[slug] = fieldResults[i];
  });

  return (
    <SiteSurfaceManage
      surface="places"
      title="Manage Places"
      backHref={firstTab ? `/places/${firstTab.slug}` : "/places"}
      initialFieldsByCategory={initialFieldsByCategory}
      initialCategories={settings.categories}
    />
  );
}
