import { revalidateTag } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
import { requireSiteEditorAccess } from "@/lib/auth";
import { CACHE_TAGS, surfaceSettingsTag } from "@/lib/cacheTags";
import { getCachedSurfaceCategorySettings } from "@/lib/cachedQueries";
import {
  addSurfaceCategory,
  isSurfaceCardLayout,
  removeSurfaceCategory,
  setSurfaceCategoryCardLayout,
  setSurfaceCategoryEnabled,
  setSurfaceCategorySupportsConcerns,
  type CategorySurface,
} from "@/lib/siteSurfaceSettings";

function parseSurface(value: string | null): CategorySurface | null {
  if (value === "places" || value === "future-interests" || value === "categories") return value;
  return null;
}

function revalidateSurfaceCache(surface: CategorySurface) {
  revalidateTag(surfaceSettingsTag(surface), "max");
  revalidateTag(CACHE_TAGS.surfaceSettings, "max");
}

export async function GET(request: NextRequest) {
  const { error: authError } = await requireSiteEditorAccess();
  if (authError) return NextResponse.json({ error: authError.message }, { status: authError.status });

  const surface = parseSurface(request.nextUrl.searchParams.get("surface"));
  if (!surface) {
    return NextResponse.json(
      { error: "surface=places|future-interests|categories required" },
      { status: 400 }
    );
  }

  try {
    const settings = await getCachedSurfaceCategorySettings(surface);
    return NextResponse.json({ settings });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const { error: authError } = await requireSiteEditorAccess();
  if (authError) return NextResponse.json({ error: authError.message }, { status: authError.status });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const surface = parseSurface(typeof body.surface === "string" ? body.surface : null);
  if (!surface) {
    return NextResponse.json(
      { error: "surface=places|future-interests|categories required" },
      { status: 400 }
    );
  }

  const action = typeof body.action === "string" ? body.action : "";
  const slug = typeof body.slug === "string" ? body.slug.trim() : "";

  try {
    if (action === "add") {
      const label = typeof body.label === "string" ? body.label.trim() : slug;
      if (!slug) return NextResponse.json({ error: "slug is required" }, { status: 400 });
      const settings = await addSurfaceCategory(surface, { slug, label });
      revalidateSurfaceCache(surface);
      return NextResponse.json({ settings });
    }
    if (action === "setEnabled") {
      if (!slug) return NextResponse.json({ error: "slug is required" }, { status: 400 });
      const settings = await setSurfaceCategoryEnabled(surface, slug, body.enabled === true);
      revalidateSurfaceCache(surface);
      return NextResponse.json({ settings });
    }
    if (action === "setCardLayout") {
      if (!slug) return NextResponse.json({ error: "slug is required" }, { status: 400 });
      if (!isSurfaceCardLayout(body.cardLayout)) {
        return NextResponse.json({ error: "cardLayout=list|grid-2|grid-3 required" }, { status: 400 });
      }
      const settings = await setSurfaceCategoryCardLayout(surface, slug, body.cardLayout);
      revalidateSurfaceCache(surface);
      return NextResponse.json({ settings });
    }
    if (action === "setSupportsConcerns") {
      if (!slug) return NextResponse.json({ error: "slug is required" }, { status: 400 });
      const settings = await setSurfaceCategorySupportsConcerns(
        surface,
        slug,
        body.supportsConcerns === true
      );
      revalidateSurfaceCache(surface);
      return NextResponse.json({ settings });
    }
    if (action === "remove") {
      if (!slug) return NextResponse.json({ error: "slug is required" }, { status: 400 });
      const settings = await removeSurfaceCategory(surface, slug);
      revalidateSurfaceCache(surface);
      return NextResponse.json({ settings });
    }

    if (Array.isArray(body.enabledCategories)) {
      const { setSurfaceCategorySettings, defaultCardLayout, defaultSupportsConcerns } = await import(
        "@/lib/siteSurfaceSettings"
      );
      const labels = body.enabledCategories as string[];
      const settings = await setSurfaceCategorySettings(surface, {
        categories: labels
          .filter((s) => typeof s === "string")
          .map((s) => ({
            slug: s,
            label: s,
            enabled: true,
            cardLayout: defaultCardLayout(s),
            supportsConcerns: defaultSupportsConcerns(s),
          })),
      });
      revalidateSurfaceCache(surface);
      return NextResponse.json({ settings });
    }

    return NextResponse.json(
      { error: "action=add|setEnabled|setCardLayout|setSupportsConcerns|remove required" },
      { status: 400 }
    );
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
