import { redirect } from "next/navigation";
import { canAccessSiteCatalog } from "@/lib/auth";
import { getFieldDefsForSiteCategory } from "@/lib/siteCategoryFields";
import { SITE_CATEGORIES } from "@/lib/siteCategories";
import { enabledCategoryTabs, getSurfaceCategorySettings } from "@/lib/siteSurfaceSettings";
import SiteSurfaceManage from "@/components/SiteSurfaceManage";
import type { FieldDef } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function FutureInterestsManagePage() {
  const canAccess = await canAccessSiteCatalog();
  if (!canAccess) redirect("/");

  const settings = await getSurfaceCategorySettings("future-interests");
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
      surface="future-interests"
      title="Manage Future Interests"
      backHref={firstTab ? `/future-interests/${firstTab.slug}` : "/future-interests"}
      initialFieldsByCategory={initialFieldsByCategory}
      initialCategories={settings.categories}
    />
  );
}
