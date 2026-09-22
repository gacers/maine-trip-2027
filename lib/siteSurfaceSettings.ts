import { cache } from "react";
import { supabaseServiceRole } from "@/lib/supabaseServer";
import { SITE_CATEGORIES, siteCategoryLabel } from "@/lib/siteCategories";
import {
  SURFACE_DEFAULT_CATEGORIES,
  defaultCardLayout,
  defaultSupportsConcerns,
  isSurfaceCardLayout,
  type CategorySurface,
  type SurfaceCardLayout,
  type SurfaceCategory,
  type SurfaceCategorySettings,
} from "@/lib/siteSurfaceShared";

export type { CategorySurface, SurfaceCardLayout, SurfaceCategory, SurfaceCategorySettings };
export {
  SURFACE_DEFAULT_CATEGORIES,
  defaultCardLayout,
  defaultSupportsConcerns,
  isSurfaceCardLayout,
};

function looksLikeSlug(s: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s);
}

function normalizeCategory(raw: unknown): SurfaceCategory | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const slug = typeof row.slug === "string" ? row.slug.trim() : "";
  if (!slug || !looksLikeSlug(slug)) return null;
  const label =
    typeof row.label === "string" && row.label.trim()
      ? row.label.trim()
      : siteCategoryLabel(slug);
  return {
    slug,
    label,
    enabled: row.enabled !== false,
    cardLayout: isSurfaceCardLayout(row.cardLayout) ? row.cardLayout : defaultCardLayout(slug),
    supportsConcerns:
      typeof row.supportsConcerns === "boolean" ? row.supportsConcerns : defaultSupportsConcerns(slug),
  };
}

function defaultSettingsFor(surface: CategorySurface): SurfaceCategorySettings {
  if (surface === "categories") {
    return {
      categories: SITE_CATEGORIES.map((c) => ({
        slug: c.slug,
        label: c.label,
        enabled: true,
        cardLayout: defaultCardLayout(c.slug),
        supportsConcerns: defaultSupportsConcerns(c.slug),
      })),
    };
  }
  return {
    categories: SURFACE_DEFAULT_CATEGORIES.map((c) => ({
      ...c,
      enabled: true,
      cardLayout: defaultCardLayout(c.slug),
      supportsConcerns: defaultSupportsConcerns(c.slug),
    })),
  };
}

function parseSettings(raw: unknown, surface: CategorySurface): SurfaceCategorySettings {
  const parsed = (raw && typeof raw === "object" ? raw : {}) as {
    categories?: unknown;
    enabledCategories?: unknown;
  };

  if (Array.isArray(parsed.categories)) {
    const categories = parsed.categories.map(normalizeCategory).filter((c): c is SurfaceCategory => !!c);
    const seen = new Set<string>();
    const unique = categories.filter((c) => {
      if (seen.has(c.slug)) return false;
      seen.add(c.slug);
      return true;
    });
    if (unique.length > 0) return { categories: unique };
  }

  if (Array.isArray(parsed.enabledCategories)) {
    const categories: SurfaceCategory[] = [];
    const seen = new Set<string>();
    for (const s of parsed.enabledCategories) {
      if (typeof s !== "string" || !looksLikeSlug(s) || seen.has(s)) continue;
      seen.add(s);
      categories.push({
        slug: s,
        label: SITE_CATEGORIES.find((c) => c.slug === s)?.label || siteCategoryLabel(s),
        enabled: true,
        cardLayout: defaultCardLayout(s),
        supportsConcerns: defaultSupportsConcerns(s),
      });
    }
    if (categories.length > 0) return { categories };
  }

  return defaultSettingsFor(surface);
}

/** Categories browse always offers SITE_CATEGORIES — fill any missing rows. */
function ensureCategoriesSurface(settings: SurfaceCategorySettings): SurfaceCategorySettings {
  const bySlug = new Map(settings.categories.map((c) => [c.slug, c]));
  const categories: SurfaceCategory[] = SITE_CATEGORIES.map((c) => {
    const existing = bySlug.get(c.slug);
    if (existing) return existing;
    return {
      slug: c.slug,
      label: c.label,
      enabled: true,
      cardLayout: defaultCardLayout(c.slug),
      supportsConcerns: defaultSupportsConcerns(c.slug),
    };
  });
  return { categories };
}

export const getSurfaceCategorySettings = cache(
  async (surface: CategorySurface): Promise<SurfaceCategorySettings> => {
    const supabase = supabaseServiceRole();
    const { data, error } = await supabase
      .from("site_surface_settings")
      .select("settings")
      .eq("surface", surface)
      .maybeSingle();
    if (error) throw new Error(error.message);
    let settings = parseSettings(data?.settings, surface);
    if (surface === "categories") settings = ensureCategoriesSurface(settings);
    return settings;
  }
);

async function saveSettings(
  surface: CategorySurface,
  settings: SurfaceCategorySettings
): Promise<SurfaceCategorySettings> {
  const supabase = supabaseServiceRole();
  const { error } = await supabase.from("site_surface_settings").upsert(
    {
      surface,
      settings,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "surface" }
  );
  if (error) throw new Error(error.message);
  return settings;
}

export function enabledCategoryTabs(
  settings: SurfaceCategorySettings
): { slug: string; label: string; cardLayout: SurfaceCardLayout }[] {
  return settings.categories
    .filter((c) => c.enabled)
    .map(({ slug, label, cardLayout }) => ({ slug, label, cardLayout }));
}

export function isCategoryConfigured(settings: SurfaceCategorySettings, slug: string): boolean {
  return settings.categories.some((c) => c.slug === slug);
}

export function isCategoryEnabled(settings: SurfaceCategorySettings, slug: string): boolean {
  return settings.categories.some((c) => c.slug === slug && c.enabled);
}

export function cardLayoutForCategory(
  settings: SurfaceCategorySettings,
  slug: string
): SurfaceCardLayout {
  return settings.categories.find((c) => c.slug === slug)?.cardLayout || defaultCardLayout(slug);
}

export function supportsConcernsForCategory(
  settings: SurfaceCategorySettings,
  slug: string
): boolean {
  const row = settings.categories.find((c) => c.slug === slug);
  if (row && typeof row.supportsConcerns === "boolean") return row.supportsConcerns;
  return defaultSupportsConcerns(slug);
}

export async function addSurfaceCategory(
  surface: CategorySurface,
  input: { slug: string; label: string }
): Promise<SurfaceCategorySettings> {
  if (surface === "categories") throw new Error("Categories tabs are fixed site-wide");
  const slug = input.slug.trim();
  const label = input.label.trim() || siteCategoryLabel(slug);
  if (!looksLikeSlug(slug)) throw new Error("Invalid category slug");
  const settings = await getSurfaceCategorySettings(surface);
  if (settings.categories.some((c) => c.slug === slug)) {
    throw new Error("That category is already added");
  }
  settings.categories.push({
    slug,
    label,
    enabled: true,
    cardLayout: defaultCardLayout(slug),
    supportsConcerns: defaultSupportsConcerns(slug),
  });
  return saveSettings(surface, settings);
}

export async function setSurfaceCategoryEnabled(
  surface: CategorySurface,
  slug: string,
  enabled: boolean
): Promise<SurfaceCategorySettings> {
  if (surface === "categories") throw new Error("Categories tabs stay enabled");
  const settings = await getSurfaceCategorySettings(surface);
  const row = settings.categories.find((c) => c.slug === slug);
  if (!row) throw new Error("Category not found on this surface");
  row.enabled = enabled;
  return saveSettings(surface, settings);
}

export async function setSurfaceCategoryCardLayout(
  surface: CategorySurface,
  slug: string,
  cardLayout: SurfaceCardLayout
): Promise<SurfaceCategorySettings> {
  if (!isSurfaceCardLayout(cardLayout)) throw new Error("Invalid card layout");
  const settings = await getSurfaceCategorySettings(surface);
  const row = settings.categories.find((c) => c.slug === slug);
  if (!row) throw new Error("Category not found on this surface");
  row.cardLayout = cardLayout;
  return saveSettings(surface, settings);
}

export async function setSurfaceCategorySupportsConcerns(
  surface: CategorySurface,
  slug: string,
  supportsConcerns: boolean
): Promise<SurfaceCategorySettings> {
  const settings = await getSurfaceCategorySettings(surface);
  const row = settings.categories.find((c) => c.slug === slug);
  if (!row) throw new Error("Category not found on this surface");
  row.supportsConcerns = !!supportsConcerns;
  return saveSettings(surface, settings);
}

/** Remove category from the surface and delete its Places / FI rows. */
export async function removeSurfaceCategory(
  surface: CategorySurface,
  slug: string
): Promise<SurfaceCategorySettings> {
  if (surface === "categories") throw new Error("Categories tabs can't be removed");
  const settings = await getSurfaceCategorySettings(surface);
  if (!settings.categories.some((c) => c.slug === slug)) {
    throw new Error("Category not found on this surface");
  }
  const supabase = supabaseServiceRole();
  const table = surface === "places" ? "place_items" : "future_interest_items";
  const { error: delError } = await supabase.from(table).delete().eq("category_slug", slug);
  if (delError) throw new Error(delError.message);

  settings.categories = settings.categories.filter((c) => c.slug !== slug);
  return saveSettings(surface, settings);
}

/** @deprecated */
export async function getPlacesSurfaceSettings(): Promise<SurfaceCategorySettings> {
  return getSurfaceCategorySettings("places");
}

/** @deprecated — prefer add / setEnabled / remove helpers */
export async function setSurfaceCategorySettings(
  surface: CategorySurface,
  settings: SurfaceCategorySettings
): Promise<SurfaceCategorySettings> {
  return saveSettings(surface, parseSettings(settings, surface));
}

/** @deprecated */
export async function setPlacesSurfaceSettings(
  settings: SurfaceCategorySettings
): Promise<SurfaceCategorySettings> {
  return setSurfaceCategorySettings("places", settings);
}
