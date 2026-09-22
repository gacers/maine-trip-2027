/** Shared Next.js cache tags — revalidateTag() after admin writes. */
export const CACHE_TAGS = {
  catalog: "catalog",
  siteCategoryFields: "site-category-fields",
  surfaceSettings: "surface-settings",
  tripNav: "trip-nav",
  trips: "trips",
} as const;

export function catalogTag(categorySlug: string) {
  return `catalog-${categorySlug}`;
}

export function siteCategoryFieldsTag(categorySlug: string) {
  return `site-category-fields-${categorySlug}`;
}

export function surfaceSettingsTag(surface: string) {
  return `surface-settings-${surface}`;
}

export function tripNavTag(tripId: string) {
  return `trip-nav-${tripId}`;
}
