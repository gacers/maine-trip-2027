import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getTripBySlug, getTripNav } from "@/lib/sections";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

function inviteQuery(invite?: string, email?: string) {
  const paramsOut = new URLSearchParams();
  if (invite) paramsOut.set("invite", invite);
  if (email) paramsOut.set("email", email);
  const qs = paramsOut.toString();
  return qs ? `?${qs}` : "";
}

// Bare trip URL (/{tripSlug}) — jump straight into the first enabled
// section. The old "Pick a section to open" list was a leftover from
// before category tabs linked into sections themselves; keeping invite/
// email on the redirect so SectionPage can still capture them.
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
  const first = nav
    .flatMap((g) => g.sections.filter((s) => s.enabled).map((s) => ({ groupSlug: g.slug, sectionSlug: s.slug })))
    .at(0);

  const qs = inviteQuery(invite, email);

  if (first) {
    redirect(`/${tripSlug}/${first.groupSlug}/${first.sectionSlug}${qs}`);
  }

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
