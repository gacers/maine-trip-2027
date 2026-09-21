// Fixed category tabs for site-level Categories + Future Interest
// browse — match the nav_groups.slug values used on trips (built-in
// stays/food-drink/activities plus the usual custom distilleries/
// wineries groups).
export const SITE_CATEGORIES = [
  { slug: "stays", label: "Stays" },
  { slug: "food-drink", label: "Food & Drink" },
  { slug: "activities", label: "Activities" },
  { slug: "distilleries", label: "Distilleries" },
  { slug: "wineries", label: "Wineries" },
] as const;

export type SiteCategorySlug = (typeof SITE_CATEGORIES)[number]["slug"];

export function isSiteCategorySlug(slug: string): slug is SiteCategorySlug {
  return SITE_CATEGORIES.some((c) => c.slug === slug);
}

export function siteCategoryLabel(slug: string): string {
  return SITE_CATEGORIES.find((c) => c.slug === slug)?.label || slug;
}
