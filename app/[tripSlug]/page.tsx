import Link from "next/link";
import { notFound } from "next/navigation";
import { getTripBySlug, getTripNav } from "@/lib/sections";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

// Bare trip URL (/{tripSlug}) — list enabled sections. Invite/email query
// params are kept on each link so SectionPage can still capture them.
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
  const sections = nav.flatMap((g) =>
    g.sections
      .filter((s) => s.enabled)
      .map((s) => ({ groupSlug: g.slug, groupLabel: g.label, section: s }))
  );

  const paramsOut = new URLSearchParams();
  if (invite) paramsOut.set("invite", invite);
  if (email) paramsOut.set("email", email);
  const qs = paramsOut.toString() ? `?${paramsOut.toString()}` : "";

  if (sections.length === 0) {
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

  return (
    <main className={styles["root"]}>
      <h1 className={styles["trip-name"]}>{trip.name}</h1>
      <p className={styles["empty-hint"]}>Pick a section to open.</p>
      <ul className={styles["section-list"]}>
        {sections.map(({ groupSlug, groupLabel, section }) => (
          <li key={`${groupSlug}-${section.slug}`}>
            <Link
              href={`/${tripSlug}/${groupSlug}/${section.slug}${qs}`}
              className={styles["section-link"]}
            >
              {groupLabel} — {section.sub_nav_label || section.label}
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
