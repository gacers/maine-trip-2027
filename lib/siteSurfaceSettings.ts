import { supabaseServiceRole } from "@/lib/supabaseServer";
import { SITE_CATEGORIES, type SiteCategorySlug, isSiteCategorySlug } from "@/lib/siteCategories";

/** Surfaces that support trip-style category enable/disable. */
export type CategorySurface = "places" | "future-interests";

export interface SurfaceCategorySettings {
  /**
   * Enabled category tabs. Default = all SITE_CATEGORIES.
   * Disabled categories stay in Manage (re-enable anytime), drop out of
   * nav, and for Future Interests skip live Options catalog merge.
   */
  enabledCategories: SiteCategorySlug[];
}

const DEFAULT_SETTINGS: SurfaceCategorySettings = {
  enabledCategories: SITE_CATEGORIES.map((c) => c.slug),
};

function parseSettings(raw: unknown): SurfaceCategorySettings {
  const obj = (raw && typeof raw === "object" ? raw : {}) as { enabledCategories?: unknown };
  const enabled = Array.isArray(obj.enabledCategories)
    ? obj.enabledCategories.filter((s): s is SiteCategorySlug => typeof s === "string" && isSiteCategorySlug(s))
    : null;
  // Empty array is intentional (all disabled) — only fall back when unset.
  if (enabled === null) return { ...DEFAULT_SETTINGS };
  return { enabledCategories: enabled };
}

export async function getSurfaceCategorySettings(
  surface: CategorySurface
): Promise<SurfaceCategorySettings> {
  const supabase = supabaseServiceRole();
  const { data, error } = await supabase
    .from("site_surface_settings")
    .select("settings")
    .eq("surface", surface)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return parseSettings(data?.settings);
}

export async function setSurfaceCategorySettings(
  surface: CategorySurface,
  settings: SurfaceCategorySettings
): Promise<SurfaceCategorySettings> {
  const enabled = settings.enabledCategories.filter(isSiteCategorySlug);
  const next: SurfaceCategorySettings = { enabledCategories: enabled };
  const supabase = supabaseServiceRole();
  const { error } = await supabase.from("site_surface_settings").upsert(
    {
      surface,
      settings: next,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "surface" }
  );
  if (error) throw new Error(error.message);
  return next;
}

export function isCategoryEnabled(
  settings: SurfaceCategorySettings,
  slug: SiteCategorySlug
): boolean {
  return settings.enabledCategories.includes(slug);
}

/** @deprecated Prefer getSurfaceCategorySettings("places") */
export async function getPlacesSurfaceSettings(): Promise<SurfaceCategorySettings> {
  return getSurfaceCategorySettings("places");
}

/** @deprecated Prefer setSurfaceCategorySettings("places", …) */
export async function setPlacesSurfaceSettings(
  settings: SurfaceCategorySettings
): Promise<SurfaceCategorySettings> {
  return setSurfaceCategorySettings("places", settings);
}
