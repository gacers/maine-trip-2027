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
  const trip = await getTripBySlug(tripSlug);
  if (!trip) notFound();

  const user = await getAdminUser();
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
            Access &amp; API Keys
          </Link>
          <Link href={`/${tripSlug}/admin/settings`} className={styles["nav-link"]}>
            Trip Settings
          </Link>
        </nav>
      </div>
      {children}
    </main>
  );
}
