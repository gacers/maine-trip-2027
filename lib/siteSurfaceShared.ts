/** Client-safe types/constants for Places / Future Interests category manage.
 * Keep server DB helpers in lib/siteSurfaceSettings.ts (uses next/headers). */

export type CategorySurface = "places" | "future-interests";

/** One category “section” on Places or Future Interests — like a trip section row. */
export interface SurfaceCategory {
  slug: string;
  label: string;
  enabled: boolean;
}

export interface SurfaceCategorySettings {
  categories: SurfaceCategory[];
}

/** Built-in defaults — same three starters trip Manage offers. */
export const SURFACE_DEFAULT_CATEGORIES: Omit<SurfaceCategory, "enabled">[] = [
  { slug: "stays", label: "Stays" },
  { slug: "food-drink", label: "Food & Drink" },
  { slug: "activities", label: "Activities" },
];
