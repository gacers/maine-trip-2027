import { notFound } from "next/navigation";
import { getTripBySlug, getSectionBySlug, getTripNav } from "@/lib/sections";
import { getImportSourceSectionInfo } from "@/lib/entrySync";
import SectionForm from "@/components/admin/SectionForm";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

export default async function EditSectionPage({
  params,
}: {
  params: Promise<{ tripSlug: string; navGroupSlug: string; sectionSlug: string }>;
}) {
  const { tripSlug, navGroupSlug, sectionSlug } = await params;
  const trip = await getTripBySlug(tripSlug);
  if (!trip) notFound();
  const section = await getSectionBySlug(trip.id, navGroupSlug, sectionSlug);
  if (!section) notFound();
  const nav = await getTripNav(trip.id);
  const navGroups = nav.map(({ sections, ...g }) => g);
  // Resolved server-side (needs a cross-trip join FieldDefsEditor
  // itself has no business making) so the form can show "synced from
  // X" and link straight to it, when this section is a destination.
  const importSource = section.import_source_section_id
    ? await getImportSourceSectionInfo(section.import_source_section_id)
    : null;

  return (
    <div className={styles["root"]}>
      <h1 className={styles["heading"]}>Edit {section.label}</h1>
      <SectionForm trip={trip} navGroups={navGroups} section={section} importSource={importSource} />
    </div>
  );
}
