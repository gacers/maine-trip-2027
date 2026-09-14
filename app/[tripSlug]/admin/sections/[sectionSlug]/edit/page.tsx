import { notFound } from "next/navigation";
import { getTripBySlug, getSectionBySlug, getTripNav } from "@/lib/sections";
import SectionForm from "@/components/admin/SectionForm";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

export default async function EditSectionPage({
  params,
}: {
  params: Promise<{ tripSlug: string; sectionSlug: string }>;
}) {
  const { tripSlug, sectionSlug } = await params;
  const trip = await getTripBySlug(tripSlug);
  if (!trip) notFound();
  const section = await getSectionBySlug(trip.id, sectionSlug);
  if (!section) notFound();
  const nav = await getTripNav(trip.id);
  const navGroups = nav.map(({ sections, ...g }) => g);

  return (
    <div className={styles.wrapper}>
      <h1 className={styles.heading}>Edit {section.label}</h1>
      <SectionForm trip={trip} navGroups={navGroups} section={section} />
    </div>
  );
}
