import { notFound } from "next/navigation";
import { canAccessSiteCatalog } from "@/lib/auth";
import { listPlaces } from "@/lib/places";
import { getAllTrips } from "@/lib/sections";
import { getFieldDefsForSiteCategory } from "@/lib/siteCategoryFields";
import { isSiteCategorySlug, siteCategoryLabel } from "@/lib/siteCategories";
import { getPlacesSurfaceSettings } from "@/lib/siteSurfaceSettings";
import PlacesPage from "@/components/PlacesPage";

export const dynamic = "force-dynamic";

export default async function PlacesSlugPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!isSiteCategorySlug(slug)) notFound();

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

  const settings = await getPlacesSurfaceSettings();
  if (!settings.enabledCategories.includes(slug)) notFound();

  const [items, trips, fieldDefs] = await Promise.all([
    listPlaces(slug),
    getAllTrips(),
    getFieldDefsForSiteCategory(slug),
  ]);
  return (
    <PlacesPage
      categorySlug={slug}
      categoryLabel={siteCategoryLabel(slug)}
      initialItems={items}
      initialFieldDefs={fieldDefs}
      geocodeTripSlug={trips[0]?.slug}
    />
  );
}
