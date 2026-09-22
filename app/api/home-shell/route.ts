import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabaseServer";
import { getCachedSurfaceCategorySettings } from "@/lib/cachedQueries";
import { enabledCategoryTabs } from "@/lib/siteSurfaceSettings";

/** One-shot bootstrap for home chrome — fetched once client-side, cached 5m. */
export async function GET() {
  try {
    const [admin, supabase] = await Promise.all([getAdminUser(), supabaseServer()]);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const isAdmin = !!admin;
    const isSignedIn = !!user;

    let placesCategoryTabs: { slug: string; label: string }[] | undefined;
    let futureInterestsCategoryTabs: { slug: string; label: string }[] | undefined;

    if (isAdmin) {
      const [places, fi] = await Promise.all([
        getCachedSurfaceCategorySettings("places"),
        getCachedSurfaceCategorySettings("future-interests"),
      ]);
      placesCategoryTabs = enabledCategoryTabs(places);
      futureInterestsCategoryTabs = enabledCategoryTabs(fi);
    }

    return NextResponse.json({
      isAdmin,
      isSignedIn,
      placesCategoryTabs,
      futureInterestsCategoryTabs,
    });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
