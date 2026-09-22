import { NextResponse, type NextRequest } from "next/server";
import { requireSiteEditorAccess } from "@/lib/auth";
import {
  getCachedFieldDefsForSiteCategory,
  getCachedSurfaceCategorySettings,
} from "@/lib/cachedQueries";
import { getFirstTripSlug } from "@/lib/sections";
import { isSiteCategorySlug, siteCategoryLabel } from "@/lib/siteCategories";
import {
  cardLayoutForCategory,
  isCategoryEnabled,
  supportsConcernsForCategory,
} from "@/lib/siteSurfaceSettings";
import type { CategorySurface } from "@/lib/siteSurfaceShared";

function parseSurface(value: string | null): CategorySurface | null {
  if (value === "places" || value === "future-interests" || value === "categories") return value;
  return null;
}

/** Page config for Categories / Places / Future Interests tabs — parallel with list fetch. */
export async function GET(request: NextRequest) {
  const { error: authError } = await requireSiteEditorAccess();
  if (authError) return NextResponse.json({ error: authError.message }, { status: authError.status });

  const surface = parseSurface(request.nextUrl.searchParams.get("surface"));
  const slug = request.nextUrl.searchParams.get("slug")?.trim() || "";
  if (!surface || !slug) {
    return NextResponse.json({ error: "surface and slug required" }, { status: 400 });
  }
  if (surface === "categories" && !isSiteCategorySlug(slug)) {
    return NextResponse.json({ error: "Unknown category" }, { status: 404 });
  }

  try {
    const settings = await getCachedSurfaceCategorySettings(surface);
    if (!isCategoryEnabled(settings, slug)) {
      return NextResponse.json({ error: "Category not enabled" }, { status: 404 });
    }

    const label =
      settings.categories.find((c) => c.slug === slug)?.label || siteCategoryLabel(slug);
    const fieldDefs = await getCachedFieldDefsForSiteCategory(slug);
    const cardLayout = cardLayoutForCategory(settings, slug);

    const body: Record<string, unknown> = {
      categoryLabel: label,
      fieldDefs,
      cardLayout,
    };

    if (surface === "places" || surface === "future-interests") {
      const geocodeTripSlug = await getFirstTripSlug();
      body.showConcerns = supportsConcernsForCategory(settings, slug);
      body.geocodeTripSlug = geocodeTripSlug;
    }

    return NextResponse.json(body);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
