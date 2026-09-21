import { NextResponse, type NextRequest } from "next/server";
import { requireSiteEditorAccess } from "@/lib/auth";
import { isSiteCategorySlug, type SiteCategorySlug } from "@/lib/siteCategories";
import {
  getSurfaceCategorySettings,
  setSurfaceCategorySettings,
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

  const raw = Array.isArray(body.enabledCategories) ? body.enabledCategories : [];
  const enabledCategories = raw.filter(
    (s): s is SiteCategorySlug => typeof s === "string" && isSiteCategorySlug(s)
  );

  try {
    const settings = await setSurfaceCategorySettings(surface, { enabledCategories });
    return NextResponse.json({ settings });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
