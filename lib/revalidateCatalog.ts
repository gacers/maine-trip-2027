import { revalidateTag } from "next/cache";
import { CACHE_TAGS, catalogTag } from "@/lib/cacheTags";

/** Bust cached cross-trip catalog after entries/places/FI change. */
export function revalidateCatalog(categorySlug?: string) {
  revalidateTag(CACHE_TAGS.catalog, "max");
  if (categorySlug) revalidateTag(catalogTag(categorySlug), "max");
}
