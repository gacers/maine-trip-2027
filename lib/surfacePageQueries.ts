import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { FieldDef } from "@/lib/types";
import type { SurfaceCardLayout } from "@/lib/siteSurfaceShared";
import type { CategorySurface } from "@/lib/siteSurfaceShared";
import type { SiteCategorySlug } from "@/lib/siteCategories";

export const surfacePageKey = (surface: CategorySurface, slug: string) =>
  ["surface-page", surface, slug] as const;

export interface SurfacePageConfig {
  categoryLabel: string;
  fieldDefs: FieldDef[];
  cardLayout: SurfaceCardLayout;
  showConcerns?: boolean;
  geocodeTripSlug?: string;
}

async function fetchSurfacePageConfig(surface: CategorySurface, slug: string): Promise<SurfacePageConfig> {
  const res = await fetch(
    `/api/surface-page?${new URLSearchParams({ surface, slug }).toString()}`
  );
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to load page");
  return data as SurfacePageConfig;
}

export function useSurfacePageConfig(surface: CategorySurface, slug: string) {
  const query = useQuery({
    queryKey: surfacePageKey(surface, slug),
    queryFn: () => fetchSurfacePageConfig(surface, slug),
    staleTime: 5 * 60_000,
    enabled: !!slug,
  });
  return {
    config: query.data,
    loading: query.isPending,
    error: query.isError ? (query.error as Error).message : "",
  };
}

export function usePrefetchSurfacePageConfig() {
  const queryClient = useQueryClient();
  return (surface: CategorySurface, slug: string) => {
    void queryClient.prefetchQuery({
      queryKey: surfacePageKey(surface, slug),
      queryFn: () => fetchSurfacePageConfig(surface, slug),
      staleTime: 5 * 60_000,
    });
  };
}

export type { SiteCategorySlug };
