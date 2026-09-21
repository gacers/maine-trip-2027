import type { ReactNode } from "react";
import { getAdminUser } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabaseServer";
import HomeShell from "@/components/HomeShell";
import { HomeActionsProvider } from "@/components/HomeShell/HomeActions";
import { getSurfaceCategorySettings } from "@/lib/siteSurfaceSettings";
import type { SiteCategorySlug } from "@/lib/siteCategories";

export const dynamic = "force-dynamic";

// Shared header + Trips | Categories | Places | Future Interests stack
// for the home surface only — trip pages keep TripNavHeader instead.
export default async function HomeLayout({ children }: { children: ReactNode }) {
  const admin = await getAdminUser();
  const isAdmin = !!admin;
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isSignedIn = !!user;

  let placesEnabledCategories: SiteCategorySlug[] | undefined;
  let futureInterestsEnabledCategories: SiteCategorySlug[] | undefined;
  if (isAdmin) {
    try {
      const [places, fi] = await Promise.all([
        getSurfaceCategorySettings("places"),
        getSurfaceCategorySettings("future-interests"),
      ]);
      placesEnabledCategories = places.enabledCategories;
      futureInterestsEnabledCategories = fi.enabledCategories;
    } catch {
      placesEnabledCategories = undefined;
      futureInterestsEnabledCategories = undefined;
    }
  }

  return (
    <HomeActionsProvider>
      <HomeShell
        isAdmin={isAdmin}
        isSignedIn={isSignedIn}
        placesEnabledCategories={placesEnabledCategories}
        futureInterestsEnabledCategories={futureInterestsEnabledCategories}
      >
        {children}
      </HomeShell>
    </HomeActionsProvider>
  );
}
