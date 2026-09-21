import { notFound } from "next/navigation";
import { canAccessSiteCatalog } from "@/lib/auth";
import { getFieldDefsForSiteCategory } from "@/lib/siteCategoryFields";
import { isSiteCategorySlug, siteCategoryLabel } from "@/lib/siteCategories";
import {
  cardLayoutForCategory,
  getSurfaceCategorySettings,
  isCategoryEnabled,
} from "@/lib/siteSurfaceSettings";
import CatalogPage from "@/components/CatalogPage";

export const dynamic = "force-dynamic";

export default async function CategorySlugPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!isSiteCategorySlug(slug)) notFound();

  const canAccess = await canAccessSiteCatalog();
  if (!canAccess) {
    return (
      <main style={{ maxWidth: "72rem", margin: "0 auto", padding: "3rem 1rem" }}>
        <p style={{ color: "var(--color-zinc-500)", textAlign: "center" }}>
          Sign in as an admin to browse categories across trips.
        </p>
      </main>
    );
  }

  const settings = await getSurfaceCategorySettings("categories");
  if (!isCategoryEnabled(settings, slug)) notFound();

  const label =
    settings.categories.find((c) => c.slug === slug)?.label || siteCategoryLabel(slug);

  const fieldDefs = await getFieldDefsForSiteCategory(slug);
  return (
    <CatalogPage
      categorySlug={slug}
      categoryLabel={label}
      fieldDefs={fieldDefs}
      cardLayout={cardLayoutForCategory(settings, slug)}
    />
  );
}
