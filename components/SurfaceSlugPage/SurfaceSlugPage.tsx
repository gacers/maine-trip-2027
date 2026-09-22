"use client";

import { useParams, notFound } from "next/navigation";
import CatalogPage from "@/components/CatalogPage";
import PlacesPage from "@/components/PlacesPage";
import FutureInterestPage from "@/components/FutureInterestPage";
import SurfacePageSkeleton from "@/components/SurfacePageSkeleton";
import { isSiteCategorySlug, type SiteCategorySlug } from "@/lib/siteCategories";
import {
  useCatalogList,
  useFutureInterestList,
  usePlacesList,
} from "@/lib/surfaceListQueries";
import { useSurfacePageConfig, type SurfacePageConfig } from "@/lib/surfacePageQueries";
import {
  defaultCardLayout,
  type CategorySurface,
  type SurfaceCardLayout,
} from "@/lib/siteSurfaceShared";
import { useHomeShell } from "@/lib/homeQueries";
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

function PageSkeleton({
  label,
  cardLayout,
  surface,
  slug,
}: {
  label?: string;
  cardLayout?: SurfaceCardLayout;
  surface: CategorySurface;
  slug: string;
}) {
  const { data: shell } = useHomeShell();
  // Places / FI use EntryCard media; Categories use Catalog thumbs.
  const tone = surface === "categories" ? "surface" : "section";
  const shellTabs =
    surface === "places"
      ? shell?.placesCategoryTabs
      : surface === "future-interests"
        ? shell?.futureInterestsCategoryTabs
        : undefined;
  const layoutFromShell = shellTabs?.find((t) => t.slug === slug)?.cardLayout;
  const layout = cardLayout ?? layoutFromShell ?? defaultCardLayout(slug);

  return (
    <main className={styles["root"]}>
      <div className={styles["toolbar"]}>
        {label ? <h1 className={styles["heading"]}>{label}</h1> : <div className={styles["heading-skel"]} />}
        <div className={styles["filter-skel"]} />
      </div>
      <SurfacePageSkeleton cardLayout={layout} tone={tone} />
    </main>
  );
}

function useSurfaceList(surface: CategorySurface, slug: string) {
  const catalog = useCatalogList(surface === "categories" ? slug : "");
  const places = usePlacesList(surface === "places" ? (slug as SiteCategorySlug) : ("" as SiteCategorySlug));
  const fi = useFutureInterestList(
    surface === "future-interests" ? (slug as SiteCategorySlug) : ("" as SiteCategorySlug)
  );
  if (surface === "categories") return catalog;
  if (surface === "places") return places;
  return fi;
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

/** Client-owned surface tab — one skeleton until config + list are both ready. */
export default function SurfaceSlugPage({ surface }: SurfaceSlugPageProps) {
  const params = useParams();
  const slug = typeof params.slug === "string" ? params.slug : "";
  if (surface === "categories" && slug && !isSiteCategorySlug(slug)) notFound();

  const { config, loading: configLoading, error } = useSurfacePageConfig(surface, slug);
  const list = useSurfaceList(surface, slug);

  if (error === "Sign in required") return <AccessDenied />;
  if (error.includes("not enabled") || error.includes("Unknown")) notFound();

  const waiting = configLoading || !config || list.loading;
  if (waiting) {
    return (
      <PageSkeleton
        label={config?.categoryLabel}
        cardLayout={config?.cardLayout}
        surface={surface}
        slug={slug}
      />
    );
  }

  if (list.error && !list.items.length) {
    return (
      <main className={styles["message"]}>
        <p>{list.error}</p>
      </main>
    );
  }

  return renderSurface(surface, slug as SiteCategorySlug, config);
}
