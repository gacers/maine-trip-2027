import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { CatalogItem } from "@/lib/catalog";
import type { FutureInterestViewItem } from "@/lib/futureInterest";
import type { PlaceItem } from "@/lib/placesShared";

export const placesListKey = (categorySlug: string) => ["places", categorySlug] as const;
export const futureInterestsListKey = (categorySlug: string) =>
  ["future-interests", categorySlug] as const;
export const catalogListKey = (categorySlug: string) => ["catalog", categorySlug] as const;

export function usePlacesList(categorySlug: string) {
  const query = useQuery({
    queryKey: placesListKey(categorySlug),
    queryFn: async () => {
      const res = await fetch(`/api/places?category=${encodeURIComponent(categorySlug)}`, {
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load places");
      return data.items as PlaceItem[];
    },
  });
  return {
    items: query.data ?? [],
    loading: query.isPending,
    error: query.isError ? (query.error as Error).message : "",
    queryKey: placesListKey(categorySlug),
  };
}

export function useFutureInterestList(categorySlug: string) {
  const query = useQuery({
    queryKey: futureInterestsListKey(categorySlug),
    queryFn: async () => {
      const res = await fetch(
        `/api/future-interests?category=${encodeURIComponent(categorySlug)}`,
        { cache: "no-store" }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load future interests");
      return data.items as FutureInterestViewItem[];
    },
  });
  return {
    items: query.data ?? [],
    loading: query.isPending,
    error: query.isError ? (query.error as Error).message : "",
    queryKey: futureInterestsListKey(categorySlug),
  };
}

export function useCatalogList(categorySlug: string) {
  const query = useQuery({
    queryKey: catalogListKey(categorySlug),
    queryFn: async () => {
      const res = await fetch(`/api/catalog/${encodeURIComponent(categorySlug)}`, {
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load catalog");
      return data.items as CatalogItem[];
    },
  });
  return {
    items: query.data ?? [],
    loading: query.isPending,
    error: query.isError ? (query.error as Error).message : "",
    queryKey: catalogListKey(categorySlug),
  };
}

/** Prefetch a surface list on category-tab hover (same keys as the hooks). */
export function usePrefetchSurfaceList() {
  const queryClient = useQueryClient();

  return function prefetch(basePath: "/places" | "/future-interests" | "/categories", slug: string) {
    if (basePath === "/places") {
      void queryClient.prefetchQuery({
        queryKey: placesListKey(slug),
        queryFn: async () => {
          const res = await fetch(`/api/places?category=${encodeURIComponent(slug)}`, {
            cache: "no-store",
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || "Failed to load places");
          return data.items as PlaceItem[];
        },
      });
      return;
    }
    if (basePath === "/future-interests") {
      void queryClient.prefetchQuery({
        queryKey: futureInterestsListKey(slug),
        queryFn: async () => {
          const res = await fetch(
            `/api/future-interests?category=${encodeURIComponent(slug)}`,
            { cache: "no-store" }
          );
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || "Failed to load future interests");
          return data.items as FutureInterestViewItem[];
        },
      });
      return;
    }
    void queryClient.prefetchQuery({
      queryKey: catalogListKey(slug),
      queryFn: async () => {
        const res = await fetch(`/api/catalog/${encodeURIComponent(slug)}`, {
          cache: "no-store",
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load catalog");
        return data.items as CatalogItem[];
      },
    });
  };
}
