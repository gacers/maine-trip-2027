import { redirect } from "next/navigation";
import { canAccessSiteCatalog } from "@/lib/auth";
import { getFieldDefsForSiteCategory } from "@/lib/siteCategoryFields";
import { SITE_CATEGORIES } from "@/lib/siteCategories";
import { getSurfaceCategorySettings } from "@/lib/siteSurfaceSettings";
import SiteSurfaceManage from "@/components/SiteSurfaceManage";
import type { FieldDef } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function FutureInterestsManagePage() {
  const canAccess = await canAccessSiteCatalog();
  if (!canAccess) redirect("/");

  const [settings, ...fieldResults] = await Promise.all([
    getSurfaceCategorySettings("future-interests"),
    ...SITE_CATEGORIES.map((c) => getFieldDefsForSiteCategory(c.slug)),
  ]);

  const initialFieldsByCategory: Record<string, FieldDef[]> = {};
  SITE_CATEGORIES.forEach((c, i) => {
    initialFieldsByCategory[c.slug] = fieldResults[i];
  });

  return (
    <SiteSurfaceManage
      surface="future-interests"
      title="Manage Future Interests"
      backHref="/future-interests"
      initialFieldsByCategory={initialFieldsByCategory}
      initialCategories={settings.categories}
    />
  );
}
