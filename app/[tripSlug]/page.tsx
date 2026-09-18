import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getTripBySlug, getTripNav } from "@/lib/sections";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

// Visiting a bare trip URL (/{tripSlug}) redirects to its first section,
// e.g. /maine-2027 -> /maine-2027/houses — matching how "/" used to just
// be the listings page directly. A brand-new trip has no sections yet
// (the New Trip flow sends you straight to the Section Designer, but
// nothing stops you from navigating away first) — show a way back to
// it instead of a bare 404.
export default async function TripDefaultPage({
  params,
  searchParams,
}: {
  params: Promise<{ tripSlug: string }>;
  searchParams: Promise<{ invite?: string; email?: string }>;
}) {
  const { tripSlug } = await params;
  const { invite, email } = await searchParams;
  const trip = await getTripBySlug(tripSlug);
  if (!trip) notFound();

  const nav = await getTripNav(trip.id);
  const firstGroup = nav.find((g) => g.sections.some((s) => s.enabled));
  const firstSection = firstGroup?.sections.find((s) => s.enabled);

  if (!firstGroup || !firstSection) {
    return (
      <main className={styles["root"]}>
        <h1 className={styles["trip-name"]}>{trip.name}</h1>
        <p className={styles["empty-hint"]}>This trip doesn&apos;t have any sections yet.</p>
        <Link href={`/${tripSlug}/admin/sections/new`} className={styles["add-section-button"]}>
          + Add a section
        </Link>
      </main>
    );
  }

  // Forward `?invite=` / `?email=` through the redirect — otherwise a
  // friend's invite link would drop the params before SectionPage ever
  // gets a chance to capture them into localStorage (see
  // lib/inviteClient.ts).
  const paramsOut = new URLSearchParams();
  if (invite) paramsOut.set("invite", invite);
  if (email) paramsOut.set("email", email);
  const qs = paramsOut.toString() ? `?${paramsOut.toString()}` : "";
  redirect(`/${tripSlug}/${firstGroup.slug}/${firstSection.slug}${qs}`);
}
