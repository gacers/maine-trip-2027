import { supabaseServiceRole } from "@/lib/supabaseServer";
import { SITE_CATEGORIES, type SiteCategorySlug, isSiteCategorySlug } from "@/lib/siteCategories";

export type SiteSurface = "places" | "categories" | "future-interests";

export interface PlacesSurfaceSettings {
  /** Category tabs shown on Places. Default = all SITE_CATEGORIES. */
  enabledCategories: SiteCategorySlug[];
}

const DEFAULT_PLACES: PlacesSurfaceSettings = {
  enabledCategories: SITE_CATEGORIES.map((c) => c.slug),
};

export async function getPlacesSurfaceSettings(): Promise<PlacesSurfaceSettings> {
  const supabase = supabaseServiceRole();
  const { data, error } = await supabase
    .from("site_surface_settings")
    .select("settings")
    .eq("surface", "places")
    .maybeSingle();
  if (error) throw new Error(error.message);
  const raw = (data?.settings || {}) as { enabledCategories?: unknown };
  const enabled = Array.isArray(raw.enabledCategories)
    ? raw.enabledCategories.filter((s): s is SiteCategorySlug => typeof s === "string" && isSiteCategorySlug(s))
    : null;
  if (!enabled || enabled.length === 0) return { ...DEFAULT_PLACES };
  return { enabledCategories: enabled };
}

export async function setPlacesSurfaceSettings(settings: PlacesSurfaceSettings): Promise<PlacesSurfaceSettings> {
  const enabled = settings.enabledCategories.filter(isSiteCategorySlug);
  if (enabled.length === 0) throw new Error("At least one category must be enabled");
  const next: PlacesSurfaceSettings = { enabledCategories: enabled };
  const supabase = supabaseServiceRole();
  const { error } = await supabase.from("site_surface_settings").upsert(
    {
      surface: "places",
      settings: next,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "surface" }
  );
  if (error) throw new Error(error.message);
  return next;
}
