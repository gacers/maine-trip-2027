import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getTripBySlug, getTripNav } from "@/lib/sections";

export const dynamic = "force-dynamic";

// Visiting a bare trip URL (/{tripSlug}) redirects to its first section,
// e.g. /maine-2027 -> /maine-2027/houses — matching how "/" used to just
// be the listings page directly. A brand-new trip has no sections yet
// (the New Trip flow sends you straight to the Section Designer, but
// nothing stops you from navigating away first) — show a way back to
// it instead of a bare 404.
export default async function TripDefaultPage({ params, searchParams }) {
  const { tripSlug } = await params;
  const { invite, add } = await searchParams;
  const trip = await getTripBySlug(tripSlug);
  if (!trip) notFound();

  const nav = await getTripNav(trip.id);
  const firstSection = nav.find((g) => g.sections.some((s) => s.enabled))?.sections.find(
    (s) => s.enabled
  );

  if (!firstSection) {
    return (
      <main className="max-w-md mx-auto px-4 py-16 flex flex-col items-center gap-4 text-center">
        <h1 className="text-xl font-bold text-zinc-900">{trip.name}</h1>
        <p className="text-zinc-500 text-sm">This trip doesn&apos;t have any sections yet.</p>
        <Link
          href={`/${tripSlug}/admin/sections/new`}
          className="rounded bg-zinc-900 text-white px-4 py-2 text-sm font-medium"
        >
          + Add a section
        </Link>
      </main>
    );
  }

  // Forward `?invite=...` (and `?add=...`, for a "share this specific
  // listing" link — see lib/inviteClient.js's captureAddUrl) through
  // the redirect — otherwise either would drop before SectionPage ever
  // gets a chance to capture it.
  const qsParams = new URLSearchParams();
  if (invite) qsParams.set("invite", invite);
  if (add) qsParams.set("add", add);
  const qs = qsParams.toString();
  redirect(`/${tripSlug}/${firstSection.slug}${qs ? `?${qs}` : ""}`);
}
