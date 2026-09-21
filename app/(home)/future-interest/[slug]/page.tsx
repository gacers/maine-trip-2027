import { notFound } from "next/navigation";
import { canAccessSiteCatalog } from "@/lib/auth";
import { listFutureInterestView } from "@/lib/futureInterest";
import { getAllTrips } from "@/lib/sections";
import {
  getFieldDefsForSiteCategory,
  syncFutureInterestTypesToCategory,
} from "@/lib/siteCategoryFields";
import { isSiteCategorySlug, siteCategoryLabel } from "@/lib/siteCategories";
import FutureInterestPage from "@/components/FutureInterestPage";

export const dynamic = "force-dynamic";

export default async function FutureInterestSlugPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!isSiteCategorySlug(slug)) notFound();

  const canAccess = await canAccessSiteCatalog();
  if (!canAccess) {
    return (
      <main style={{ maxWidth: "72rem", margin: "0 auto", padding: "3rem 1rem" }}>
        <p style={{ color: "var(--color-zinc-500)", textAlign: "center" }}>
          Sign in as an admin to manage Future Interest.
        </p>
      </main>
    );
  }

  // Promote any FI-only type tags (e.g. Whisky Bar created before the
  // shared AddFieldSelect path) onto trip section field_defs.
  if (slug === "food-drink" || slug === "activities") {
    await syncFutureInterestTypesToCategory(slug);
  }

  const [items, trips, fieldDefs] = await Promise.all([
    listFutureInterestView(slug),
    getAllTrips(),
    getFieldDefsForSiteCategory(slug),
  ]);
  return (
    <FutureInterestPage
      categorySlug={slug}
      categoryLabel={siteCategoryLabel(slug)}
      initialItems={items}
      initialFieldDefs={fieldDefs}
      geocodeTripSlug={trips[0]?.slug}
    />
  );
}
