import { redirect } from "next/navigation";
import { canAccessSiteCatalog } from "@/lib/auth";
import { getSurfaceCategorySettings } from "@/lib/siteSurfaceSettings";

export const dynamic = "force-dynamic";

export default async function PlacesIndexPage() {
  const canAccess = await canAccessSiteCatalog();
  if (!canAccess) redirect("/");
  const settings = await getSurfaceCategorySettings("places");
  const first = settings.enabledCategories[0];
  if (!first) redirect("/places/manage");
  redirect(`/places/${first}`);
}
