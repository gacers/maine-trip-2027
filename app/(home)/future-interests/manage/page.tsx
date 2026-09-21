import { redirect } from "next/navigation";
import { canAccessSiteCatalog } from "@/lib/auth";
import { getFieldDefsForSiteCategory } from "@/lib/siteCategoryFields";
import { SITE_CATEGORIES } from "@/lib/siteCategories";
import SiteSurfaceManage from "@/components/SiteSurfaceManage";
import type { FieldDef } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function FutureInterestsManagePage() {
  const canAccess = await canAccessSiteCatalog();
  if (!canAccess) redirect("/");

  const initialFieldsByCategory: Record<string, FieldDef[]> = {};
  await Promise.all(
    SITE_CATEGORIES.map(async (c) => {
      initialFieldsByCategory[c.slug] = await getFieldDefsForSiteCategory(c.slug);
    })
  );

  return (
    <SiteSurfaceManage
      surface="future-interests"
      title="Manage Future Interests"
      backHref="/future-interests/stays"
      initialFieldsByCategory={initialFieldsByCategory}
    />
  );
}
