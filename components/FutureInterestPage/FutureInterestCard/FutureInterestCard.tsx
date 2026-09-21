import EntryMedia from "@/components/EntryMedia";
import EntryBadgesRow from "@/components/EntryCard/EntryBadgesRow";
import EntryDescription from "@/components/EntryCard/EntryDescription";
import Button from "@/components/Button";
import { assignBadgeVariants } from "@/components/Badge";
import { toBullets } from "@/lib/fieldTypes/textarea";
import {
  ACTIVITIES_TYPE_FIELD_DEFS,
  FOOD_DRINK_TYPE_FIELD_DEFS,
  type TemplateFieldDef,
} from "@/lib/sectionTemplates";
import type { FutureInterestItem } from "@/lib/futureInterest";
import type { SiteCategorySlug } from "@/lib/siteCategories";
import type { FieldDef } from "@/lib/types";
import styles from "./FutureInterestCard.module.css";

export interface FutureInterestCardProps {
  item: FutureInterestItem;
  categorySlug: SiteCategorySlug;
  onMarkVisited: (id: string) => void;
  onRemove: (id: string) => void;
}

function typeDefsForCategory(slug: SiteCategorySlug): TemplateFieldDef[] {
  if (slug === "food-drink") return FOOD_DRINK_TYPE_FIELD_DEFS;
  if (slug === "activities") return ACTIVITIES_TYPE_FIELD_DEFS;
  return [];
}

function asFieldDef(f: TemplateFieldDef): FieldDef {
  return {
    id: f.key,
    section_id: "",
    key: f.key,
    label: f.label,
    field_type: f.field_type,
    storage: "jsonb",
    core_column: null,
    options: f.options || null,
    sort_order: 0,
    show_on_overview: f.show_on_overview,
    required: false,
  };
}

// Read-only EntryCard-shaped presentation for a Future Interest item —
// same media / badges / title / description chrome as trip section
// cards, with Mark visited / Remove instead of edit/rate.
export default function FutureInterestCard({
  item,
  categorySlug,
  onMarkVisited,
  onRemove,
}: FutureInterestCardProps) {
  const isStays = categorySlug === "stays";
  const typeDefs = typeDefsForCategory(categorySlug);
  const activeBooleanFields = typeDefs
    .filter((f) => item.data?.[f.key] === true || item.data?.[f.key] === "true")
    .map(asFieldDef);
  const badgeVariants = assignBadgeVariants(typeDefs.map((f) => f.key));

  const mediaEntry = {
    posterImage: item.poster_image,
    title: item.title,
    averageScore: null as number | null,
    ratingCount: 0,
  };

  const descriptionBullets = toBullets(item.description);
  const hasCoords = item.lat != null && item.lng != null;
  const mapsUrl = hasCoords
    ? `https://www.google.com/maps/search/?api=1&query=${item.lat},${item.lng}`
    : undefined;
  const titleHref = item.url || mapsUrl || undefined;

  return (
    <article id={`fi-${item.id}`} className={styles["root"]}>
      <EntryMedia entry={mediaEntry} compact={!isStays} medium={isStays} />
      <div className={styles["sections"]}>
        <div className={styles["section"]}>
          {activeBooleanFields.length > 0 && (
            <EntryBadgesRow activeBooleanFields={activeBooleanFields} badgeVariants={badgeVariants} />
          )}
          <div className={styles["title-block"]}>
            {titleHref ? (
              <a href={titleHref} target="_blank" rel="noopener noreferrer" className={styles["title-link"]}>
                {item.title || "Untitled"}
              </a>
            ) : (
              <span className={styles["title-link"]}>{item.title || "Untitled"}</span>
            )}
            {item.country ? (
              mapsUrl ? (
                <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className={styles["meta-link"]}>
                  {item.country}
                </a>
              ) : (
                <span className={styles["meta-link"]}>{item.country}</span>
              )
            ) : mapsUrl ? (
              <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className={styles["meta-link"]}>
                View on map
              </a>
            ) : null}
            {item.visited ? <span className={styles["visited"]}>Visited</span> : null}
          </div>
          {descriptionBullets.length > 0 && <EntryDescription bullets={descriptionBullets} />}
        </div>
        <div className={styles["section"]}>
          <div className={styles["actions"]}>
            {!item.visited && (
              <Button variant="secondary" size="sm" onClick={() => onMarkVisited(item.id)}>
                Mark visited
              </Button>
            )}
            <Button variant="danger" size="sm" onClick={() => onRemove(item.id)}>
              Remove
            </Button>
          </div>
        </div>
      </div>
    </article>
  );
}
