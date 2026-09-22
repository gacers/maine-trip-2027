import { notFound, redirect } from "next/navigation";
import { getTripBySlug, getTripNav } from "@/lib/sections";

export const dynamic = "force-dynamic";

// /{tripSlug}/{navGroupSlug} — e.g. /la-mision-july-2022/stays — lands
// on that group's first enabled section. Category tabs already deep-link
// to a section; this covers typed/shared short URLs and completed trips
// whose only section is otherwise buried under …/previously-visited.
export default async function TripNavGroupPage({
  params,
  searchParams,
}: {
  params: Promise<{ tripSlug: string; navGroupSlug: string }>;
  searchParams: Promise<{ invite?: string; email?: string }>;
}) {
  const { tripSlug, navGroupSlug } = await params;
  const { invite, email } = await searchParams;
  const trip = await getTripBySlug(tripSlug);
  if (!trip) notFound();

  const nav = await getTripNav(trip.id);
  const group = nav.find((g) => g.slug === navGroupSlug);
  const section = group?.sections.find((s) => s.enabled) ?? group?.sections[0];
  if (!group || !section) notFound();

  const paramsOut = new URLSearchParams();
  if (invite) paramsOut.set("invite", invite);
  if (email) paramsOut.set("email", email);
  const qs = paramsOut.toString() ? `?${paramsOut.toString()}` : "";

  redirect(`/${tripSlug}/${navGroupSlug}/${section.slug}${qs}`);
}
