import { redirect } from "next/navigation";
import { canAccessSiteCatalog } from "@/lib/auth";
import { getPlacesSurfaceSettings } from "@/lib/siteSurfaceSettings";
import { SITE_CATEGORIES } from "@/lib/siteCategories";

export const dynamic = "force-dynamic";

export default async function PlacesIndexPage() {
  const canAccess = await canAccessSiteCatalog();
  if (!canAccess) redirect("/");
  const settings = await getPlacesSurfaceSettings();
  const first = settings.enabledCategories[0] || SITE_CATEGORIES[0].slug;
  redirect(`/places/${first}`);
}
