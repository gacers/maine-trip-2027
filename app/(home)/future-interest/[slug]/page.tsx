import { notFound } from "next/navigation";
import { canAccessSiteCatalog } from "@/lib/auth";
import { listFutureInterest } from "@/lib/futureInterest";
import { getAllTrips } from "@/lib/sections";
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

  const [items, trips] = await Promise.all([listFutureInterest(slug, { includeVisited: true }), getAllTrips()]);
  return (
    <FutureInterestPage
      categorySlug={slug}
      categoryLabel={siteCategoryLabel(slug)}
      initialItems={items}
      geocodeTripSlug={trips[0]?.slug}
    />
  );
}
