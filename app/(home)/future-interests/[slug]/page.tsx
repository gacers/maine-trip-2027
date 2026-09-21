import { notFound } from "next/navigation";
import { canAccessSiteCatalog } from "@/lib/auth";
import { listFutureInterestView } from "@/lib/futureInterest";
import { getAllTrips } from "@/lib/sections";
import {
  getFieldDefsForSiteCategory,
  syncFutureInterestTypesToCategory,
} from "@/lib/siteCategoryFields";
import { siteCategoryLabel, type SiteCategorySlug } from "@/lib/siteCategories";
import { getSurfaceCategorySettings, isCategoryEnabled, cardLayoutForCategory, supportsConcernsForCategory } from "@/lib/siteSurfaceSettings";
import FutureInterestPage from "@/components/FutureInterestPage";

export const dynamic = "force-dynamic";

export default async function FutureInterestSlugPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const canAccess = await canAccessSiteCatalog();
  if (!canAccess) {
    return (
      <main style={{ maxWidth: "72rem", margin: "0 auto", padding: "3rem 1rem" }}>
        <p style={{ color: "var(--color-zinc-500)", textAlign: "center" }}>
          Sign in as an admin to manage Future Interests.
        </p>
      </main>
    );
  }

  const settings = await getSurfaceCategorySettings("future-interests");
  if (!isCategoryEnabled(settings, slug)) notFound();

  const categorySlug = slug as SiteCategorySlug;
  if (slug === "food-drink" || slug === "activities") {
    await syncFutureInterestTypesToCategory(categorySlug);
  }

  const label =
    settings.categories.find((c) => c.slug === slug)?.label || siteCategoryLabel(slug);

  const [items, trips, fieldDefs] = await Promise.all([
    listFutureInterestView(categorySlug),
    getAllTrips(),
    getFieldDefsForSiteCategory(slug),
  ]);
  return (
    <FutureInterestPage
      categorySlug={categorySlug}
      categoryLabel={label}
      initialItems={items}
      initialFieldDefs={fieldDefs}
      geocodeTripSlug={trips[0]?.slug}
      cardLayout={cardLayoutForCategory(settings, slug)}
      showConcerns={supportsConcernsForCategory(settings, slug)}
    />
  );
}
