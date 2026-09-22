import { useQuery } from "@tanstack/react-query";
import type { SurfaceCardLayout } from "@/lib/siteSurfaceShared";

export const homeShellKey = ["home-shell"] as const;
export const tripsIndexKey = ["trips-index"] as const;

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

export interface TripsIndexItem {
  trip: {
    id: string;
    slug: string;
    name: string;
    cover_image: string | null;
    start_date: string | null;
    end_date: string | null;
    completed: boolean;
  };
  dateLabel: string | null;
  past: boolean;
  href: string;
}

export function useTripsIndex() {
  return useQuery({
    queryKey: tripsIndexKey,
    queryFn: async () => {
      const res = await fetch("/api/trips/index");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load trips");
      return data as {
        items: TripsIndexItem[];
        filterByInviteTokens: boolean;
        isAdmin: boolean;
        isSignedIn: boolean;
      };
    },
    staleTime: 60_000,
  });
}
