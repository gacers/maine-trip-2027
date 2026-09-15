import { notFound } from "next/navigation";
import { getTripBySlug, getTripNav } from "@/lib/sections";
import SectionForm from "@/components/admin/SectionForm";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

export default async function NewSectionPage({ params }: { params: Promise<{ tripSlug: string }> }) {
  const { tripSlug } = await params;
  const trip = await getTripBySlug(tripSlug);
  if (!trip) notFound();
  const nav = await getTripNav(trip.id);
  const navGroups = nav.map(({ sections, ...g }) => g);

  return (
    <div className={styles["root"]}>
      <h1 className={styles["heading"]}>New section</h1>
      <SectionForm trip={trip} navGroups={navGroups} />
    </div>
  );
}
