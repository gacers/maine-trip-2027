import { useQuery } from "@tanstack/react-query";
import type { SurfaceCardLayout } from "@/lib/siteSurfaceShared";

export const homeShellKey = ["home-shell"] as const;

export interface HomeShellCategoryTab {
  slug: string;
  label: string;
  cardLayout?: SurfaceCardLayout;
}

export interface HomeShellData {
  isAdmin: boolean;
  isSignedIn: boolean;
  placesCategoryTabs?: HomeShellCategoryTab[];
  futureInterestsCategoryTabs?: HomeShellCategoryTab[];
}

export function useHomeShell() {
  return useQuery({
    queryKey: homeShellKey,
    queryFn: async () => {
      const res = await fetch("/api/home-shell");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load shell");
      return data as HomeShellData;
    },
    staleTime: 5 * 60_000,
  });
}
