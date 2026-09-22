/** Client-safe types/constants for Places / Future Interests / Categories manage.
 * Keep server DB helpers in lib/siteSurfaceSettings.ts (uses next/headers). */

export type CategorySurface = "places" | "future-interests" | "categories";

/** Same options as trip section card_layout. */
export type SurfaceCardLayout = "list" | "grid-2" | "grid-3";

export const SURFACE_CARD_LAYOUTS: SurfaceCardLayout[] = ["list", "grid-2", "grid-3"];

export function defaultCardLayout(slug: string): SurfaceCardLayout {
  return slug === "stays" ? "grid-2" : "grid-3";
}

/** Concerns on by default for Stays (option-style cards); off elsewhere. */
export function defaultSupportsConcerns(slug: string): boolean {
  return slug === "stays";
}

export function isSurfaceCardLayout(value: unknown): value is SurfaceCardLayout {
  return value === "list" || value === "grid-2" || value === "grid-3";
}

/** One category “section” on Places, Future Interests, or Categories. */
export interface SurfaceCategory {
  slug: string;
  label: string;
  enabled: boolean;
  /** How cards lay out on this category browse page. */
  cardLayout: SurfaceCardLayout;
  /** Show Concerns on cards in this category. */
  supportsConcerns: boolean;
}

export interface SurfaceCategorySettings {
  categories: SurfaceCategory[];
}

/** Built-in defaults — same three starters trip Manage offers. */
export const SURFACE_DEFAULT_CATEGORIES: Omit<SurfaceCategory, "enabled" | "cardLayout" | "supportsConcerns">[] = [
  { slug: "stays", label: "Stays" },
  { slug: "food-drink", label: "Food & Drink" },
  { slug: "activities", label: "Activities" },
];

export const CARD_LAYOUT_LABELS: Record<SurfaceCardLayout, string> = {
  list: "One per row",
  "grid-2": "Two per row",
  "grid-3": "Three per row",
};
