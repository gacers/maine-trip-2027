import { unstable_cache } from "next/cache";
import { getCatalogForCategory } from "@/lib/catalog";
import { getFieldDefsForSiteCategory } from "@/lib/siteCategoryFields";
import { getAllTrips } from "@/lib/sections";
import { getSurfaceCategorySettings } from "@/lib/siteSurfaceSettings";
import type { CategorySurface } from "@/lib/siteSurfaceShared";
import {
  CACHE_TAGS,
  catalogTag,
  siteCategoryFieldsTag,
  surfaceSettingsTag,
} from "@/lib/cacheTags";

const REVALIDATE_SECONDS = 60;

export function getCachedCatalogForCategory(categorySlug: string) {
  return unstable_cache(
    () => getCatalogForCategory(categorySlug),
    ["catalog-for-category", categorySlug],
    { revalidate: REVALIDATE_SECONDS, tags: [CACHE_TAGS.catalog, catalogTag(categorySlug)] }
  )();
}

export function getCachedFieldDefsForSiteCategory(categorySlug: string) {
  return unstable_cache(
    () => getFieldDefsForSiteCategory(categorySlug),
    ["site-category-fields", categorySlug],
    {
      revalidate: REVALIDATE_SECONDS,
      tags: [CACHE_TAGS.siteCategoryFields, siteCategoryFieldsTag(categorySlug)],
    }
  )();
}

export function getCachedSurfaceCategorySettings(surface: CategorySurface) {
  return unstable_cache(
    () => getSurfaceCategorySettings(surface),
    ["surface-settings", surface],
    { revalidate: REVALIDATE_SECONDS, tags: [CACHE_TAGS.surfaceSettings, surfaceSettingsTag(surface)] }
  )();
}

export function getCachedAllTrips() {
  return unstable_cache(
    () => getAllTrips(),
    ["all-trips"],
    { revalidate: REVALIDATE_SECONDS, tags: [CACHE_TAGS.trips] }
  )();
}
