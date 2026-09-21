import type { SupabaseClient } from "@supabase/supabase-js";
import { getOrComputeCountry } from "@/lib/geocodeCache";

/** Resolve entry.country from coordinates (US → state, else country),
 * falling back to tripCountry when there's no lat/lng or Google fails. */
export async function resolveEntryCountry(
  supabase: SupabaseClient,
  lat: number | null | undefined,
  lng: number | null | undefined,
  tripCountry?: string | null
): Promise<string | null> {
  if (lat != null && lng != null && Number.isFinite(Number(lat)) && Number.isFinite(Number(lng))) {
    const resolved = await getOrComputeCountry(supabase, Number(lat), Number(lng)).catch(() => null);
    if (resolved?.country) return resolved.country;
  }
  return tripCountry?.trim() || null;
}
