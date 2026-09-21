"use client";

import { useState } from "react";
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
import FutureInterestEditForm, { type FutureInterestDraft } from "./FutureInterestEditForm";
import styles from "./FutureInterestCard.module.css";

export interface FutureInterestCardProps {
  item: FutureInterestItem;
  categorySlug: SiteCategorySlug;
  onUpdated: (item: FutureInterestItem) => void;
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

function draftFromItem(item: FutureInterestItem, typeDefs: TemplateFieldDef[]): FutureInterestDraft {
  const data: Record<string, string | boolean> = {};
  for (const f of typeDefs) {
    data[f.key] = item.data?.[f.key] === true || item.data?.[f.key] === "true";
  }
  return {
    title: item.title || "",
    url: item.url || "",
    posterImage: item.poster_image || "",
    description: item.description || "",
    lat: item.lat ?? "",
    lng: item.lng ?? "",
    data,
  };
}

export default function FutureInterestCard({
  item,
  categorySlug,
  onUpdated,
  onMarkVisited,
  onRemove,
}: FutureInterestCardProps) {
  const isStays = categorySlug === "stays";
  const typeDefs = typeDefsForCategory(categorySlug);
  const typeFieldDefs = typeDefs.map(asFieldDef);
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState<FutureInterestDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

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

  function startEdit() {
    setDraft(draftFromItem(item, typeDefs));
    setErrorMsg("");
    setIsEditing(true);
  }

  function cancelEdit() {
    setIsEditing(false);
    setDraft(null);
    setErrorMsg("");
  }

  async function saveEdit() {
    if (!draft) return;
    if (!draft.title.trim()) {
      setErrorMsg("Title is required.");
      return;
    }
    if (categorySlug === "food-drink") {
      const picked = typeDefs.some((f) => draft.data[f.key] === true);
      if (!picked) {
        setErrorMsg("Pick at least one type (Restaurant, Bar, …).");
        return;
      }
    }
    setSaving(true);
    setErrorMsg("");
    const data: Record<string, unknown> = {};
    for (const f of typeDefs) {
      if (draft.data[f.key] === true) data[f.key] = true;
    }
    try {
      const res = await fetch(`/api/future-interest/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: draft.title.trim() || null,
          url: draft.url.trim() || null,
          posterImage: draft.posterImage.trim() || null,
          description: draft.description.trim() || null,
          lat: draft.lat === "" ? null : Number(draft.lat),
          lng: draft.lng === "" ? null : Number(draft.lng),
          data,
        }),
      });
      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error || "Save failed");
      onUpdated(resData.item);
      setIsEditing(false);
      setDraft(null);
    } catch (err) {
      setErrorMsg((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <article id={`fi-${item.id}`} className={styles["root"]}>
      {!isEditing && <EntryMedia entry={mediaEntry} compact={!isStays} medium={isStays} />}
      <div className={styles["sections"]}>
        {isEditing && draft ? (
          <div className={styles["section"]}>
            {errorMsg ? <p className={styles["error"]}>{errorMsg}</p> : null}
            <FutureInterestEditForm draft={draft} onChange={setDraft} typeFieldDefs={typeFieldDefs} />
            <div className={styles["actions"]}>
              <Button variant="primary" size="sm" onClick={saveEdit} disabled={saving}>
                {saving ? "Saving…" : "Save"}
              </Button>
              <Button variant="ghost" size="sm" onClick={cancelEdit} disabled={saving}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <>
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
                <Button variant="ghost" size="sm" onClick={startEdit}>
                  Edit details
                </Button>
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
          </>
        )}
      </div>
    </article>
  );
}
