import { NextResponse, type NextRequest } from "next/server";
import { requireSiteEditorAccess } from "@/lib/auth";
import { getSurfaceCategorySettings, setSurfaceCategorySettings, defaultCardLayout, defaultSupportsConcerns } from "@/lib/siteSurfaceSettings";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/** @deprecated Prefer /api/site-surface-settings?surface=places */
export async function GET() {
  const { error: authError } = await requireSiteEditorAccess();
  if (authError) return NextResponse.json({ error: authError.message }, { status: authError.status });

  try {
    const settings = await getSurfaceCategorySettings("places");
    return NextResponse.json({ settings });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

/** @deprecated Prefer /api/site-surface-settings */
export async function PUT(request: NextRequest) {
  const { error: authError } = await requireSiteEditorAccess();
  if (authError) return NextResponse.json({ error: authError.message }, { status: authError.status });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const raw = Array.isArray(body.enabledCategories) ? body.enabledCategories : [];
  const enabledCategories = raw.filter((s): s is string => typeof s === "string");

  try {
    const settings = await setSurfaceCategorySettings("places", {
      categories: enabledCategories.map((slug) => ({
        slug,
        label: slug,
        enabled: true,
        cardLayout: defaultCardLayout(slug),
        supportsConcerns: defaultSupportsConcerns(slug),
      })),
    });
    return NextResponse.json({ settings });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
