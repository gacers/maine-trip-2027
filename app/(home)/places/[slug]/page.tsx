import { notFound } from "next/navigation";
import { canAccessSiteCatalog } from "@/lib/auth";
import { listPlaces } from "@/lib/places";
import { getAllTrips } from "@/lib/sections";
import { getFieldDefsForSiteCategory } from "@/lib/siteCategoryFields";
import { siteCategoryLabel, type SiteCategorySlug } from "@/lib/siteCategories";
import { getSurfaceCategorySettings, isCategoryEnabled, cardLayoutForCategory, supportsConcernsForCategory } from "@/lib/siteSurfaceSettings";
import PlacesPage from "@/components/PlacesPage";

export const dynamic = "force-dynamic";

export default async function PlacesSlugPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const canAccess = await canAccessSiteCatalog();
  if (!canAccess) {
    return (
      <main style={{ maxWidth: "72rem", margin: "0 auto", padding: "3rem 1rem" }}>
        <p style={{ color: "var(--color-zinc-500)", textAlign: "center" }}>
          Sign in as an admin to manage Places.
        </p>
      </main>
    );
  }

  const settings = await getSurfaceCategorySettings("places");
  if (!isCategoryEnabled(settings, slug)) notFound();

  const categorySlug = slug as SiteCategorySlug;
  const label =
    settings.categories.find((c) => c.slug === slug)?.label || siteCategoryLabel(slug);

  const [items, trips, fieldDefs] = await Promise.all([
    listPlaces(categorySlug),
    getAllTrips(),
    getFieldDefsForSiteCategory(categorySlug),
  ]);
  return (
    <PlacesPage
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
