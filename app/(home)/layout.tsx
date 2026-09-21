import type { ReactNode } from "react";
import { getAdminUser } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabaseServer";
import HomeShell from "@/components/HomeShell";
import { HomeActionsProvider } from "@/components/HomeShell/HomeActions";
import { enabledCategoryTabs, getSurfaceCategorySettings } from "@/lib/siteSurfaceSettings";

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

  let placesCategoryTabs: { slug: string; label: string }[] | undefined;
  let futureInterestsCategoryTabs: { slug: string; label: string }[] | undefined;
  if (isAdmin) {
    try {
      const [places, fi] = await Promise.all([
        getSurfaceCategorySettings("places"),
        getSurfaceCategorySettings("future-interests"),
      ]);
      placesCategoryTabs = enabledCategoryTabs(places);
      futureInterestsCategoryTabs = enabledCategoryTabs(fi);
    } catch {
      placesCategoryTabs = undefined;
      futureInterestsCategoryTabs = undefined;
    }
  }

  return (
    <HomeActionsProvider>
      <HomeShell
        isAdmin={isAdmin}
        isSignedIn={isSignedIn}
        placesCategoryTabs={placesCategoryTabs}
        futureInterestsCategoryTabs={futureInterestsCategoryTabs}
      >
        {children}
      </HomeShell>
    </HomeActionsProvider>
  );
}
