"use client";

import { useParams, notFound } from "next/navigation";
import CatalogPage from "@/components/CatalogPage";
import PlacesPage from "@/components/PlacesPage";
import FutureInterestPage from "@/components/FutureInterestPage";
import SurfacePageSkeleton from "@/components/SurfacePageSkeleton";
import { isSiteCategorySlug, type SiteCategorySlug } from "@/lib/siteCategories";
import { useSurfacePageConfig, type SurfacePageConfig } from "@/lib/surfacePageQueries";
import type { CategorySurface } from "@/lib/siteSurfaceShared";
import styles from "./SurfaceSlugPage.module.css";

export interface SurfaceSlugPageProps {
  surface: CategorySurface;
}

function AccessDenied() {
  return (
    <main className={styles["message"]}>
      <p>Sign in as an admin to browse this section.</p>
    </main>
  );
}

function ConfigSkeleton({ label }: { label?: string }) {
  return (
    <main className={styles["root"]}>
      {label ? <h1 className={styles["heading"]}>{label}</h1> : null}
      <SurfacePageSkeleton />
    </main>
  );
}

function renderSurface(
  surface: CategorySurface,
  slug: SiteCategorySlug,
  config: SurfacePageConfig
) {
  if (surface === "categories") {
    return (
      <CatalogPage
        categorySlug={slug}
        categoryLabel={config.categoryLabel}
        fieldDefs={config.fieldDefs}
        cardLayout={config.cardLayout}
      />
    );
  }
  if (surface === "places") {
    return (
      <PlacesPage
        categorySlug={slug}
        categoryLabel={config.categoryLabel}
        initialFieldDefs={config.fieldDefs}
        geocodeTripSlug={config.geocodeTripSlug}
        cardLayout={config.cardLayout}
        showConcerns={config.showConcerns}
      />
    );
  }
  return (
    <FutureInterestPage
      categorySlug={slug}
      categoryLabel={config.categoryLabel}
      initialFieldDefs={config.fieldDefs}
      geocodeTripSlug={config.geocodeTripSlug}
      cardLayout={config.cardLayout}
      showConcerns={config.showConcerns}
    />
  );
}

/** Client-owned surface tab — slug from URL, config + list load in parallel. */
export default function SurfaceSlugPage({ surface }: SurfaceSlugPageProps) {
  const params = useParams();
  const slug = typeof params.slug === "string" ? params.slug : "";
  if (surface === "categories" && slug && !isSiteCategorySlug(slug)) notFound();

  const { config, loading, error } = useSurfacePageConfig(surface, slug);

  if (error === "Sign in required") return <AccessDenied />;
  if (error.includes("not enabled") || error.includes("Unknown")) notFound();
  if (loading) return <ConfigSkeleton />;
  if (!config) {
    if (error) {
      return (
        <main className={styles["message"]}>
          <p>{error}</p>
        </main>
      );
    }
    return <ConfigSkeleton />;
  }

  return renderSurface(surface, slug as SiteCategorySlug, config);
}
