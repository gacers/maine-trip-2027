import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import type { ReactNode } from "react";
import { getAdminUser } from "@/lib/auth";
import { getTripBySlug } from "@/lib/sections";
import styles from "./layout.module.css";

export const dynamic = "force-dynamic";

export default async function TripAdminLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ tripSlug: string }>;
}) {
  const { tripSlug } = await params;
  // Independent of each other — both always needed regardless of which
  // resolves which way, so no reason to make one wait on the other.
  const [trip, user] = await Promise.all([getTripBySlug(tripSlug), getAdminUser()]);
  if (!trip) notFound();
  if (!user) redirect(`/login?next=/${tripSlug}/admin/sections`);

  return (
    <main className={styles["root"]}>
      <div className={styles["header"]}>
        <Link href={`/${trip.slug}`} className={styles["back-link"]}>
          &larr; Back to {trip.name}
        </Link>
        <nav className={styles["nav"]}>
          <Link href={`/${tripSlug}/admin/sections`} className={styles["nav-link"]}>
            Sections
          </Link>
          <Link href={`/${tripSlug}/admin/api-keys`} className={styles["nav-link"]}>
            Access
          </Link>
          <Link href={`/${tripSlug}/admin/settings`} className={styles["nav-link"]}>
            Trip Settings
          </Link>
        </nav>
      </div>
      <div className={styles["body"]}>{children}</div>
    </main>
  );
}
