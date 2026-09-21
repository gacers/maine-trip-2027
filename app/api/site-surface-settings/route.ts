import { NextResponse, type NextRequest } from "next/server";
import { requireSiteEditorAccess } from "@/lib/auth";
import {
  addSurfaceCategory,
  getSurfaceCategorySettings,
  removeSurfaceCategory,
  setSurfaceCategoryEnabled,
  type CategorySurface,
} from "@/lib/siteSurfaceSettings";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function parseSurface(value: string | null): CategorySurface | null {
  if (value === "places" || value === "future-interests") return value;
  return null;
}

export async function GET(request: NextRequest) {
  const { error: authError } = await requireSiteEditorAccess();
  if (authError) return NextResponse.json({ error: authError.message }, { status: authError.status });

  const surface = parseSurface(request.nextUrl.searchParams.get("surface"));
  if (!surface) {
    return NextResponse.json({ error: "surface=places|future-interests required" }, { status: 400 });
  }

  try {
    const settings = await getSurfaceCategorySettings(surface);
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
    return NextResponse.json({ error: "surface=places|future-interests required" }, { status: 400 });
  }

  const action = typeof body.action === "string" ? body.action : "";
  const slug = typeof body.slug === "string" ? body.slug.trim() : "";

  try {
    if (action === "add") {
      const label = typeof body.label === "string" ? body.label.trim() : slug;
      if (!slug) return NextResponse.json({ error: "slug is required" }, { status: 400 });
      const settings = await addSurfaceCategory(surface, { slug, label });
      return NextResponse.json({ settings });
    }
    if (action === "setEnabled") {
      if (!slug) return NextResponse.json({ error: "slug is required" }, { status: 400 });
      const settings = await setSurfaceCategoryEnabled(surface, slug, body.enabled === true);
      return NextResponse.json({ settings });
    }
    if (action === "remove") {
      if (!slug) return NextResponse.json({ error: "slug is required" }, { status: 400 });
      const settings = await removeSurfaceCategory(surface, slug);
      return NextResponse.json({ settings });
    }

    // Legacy: replace enabledCategories list (migrate callers).
    if (Array.isArray(body.enabledCategories)) {
      const { setSurfaceCategorySettings } = await import("@/lib/siteSurfaceSettings");
      const labels = body.enabledCategories as string[];
      const settings = await setSurfaceCategorySettings(surface, {
        categories: labels
          .filter((s) => typeof s === "string")
          .map((s) => ({ slug: s, label: s, enabled: true })),
      });
      return NextResponse.json({ settings });
    }

    return NextResponse.json({ error: "action=add|setEnabled|remove required" }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
