"use client";

import { useEffect, useState, type ReactNode, type FormEvent } from "react";
import ListingMap from "@/components/ListingMap";
import SimplePlaceMap from "@/components/SimplePlaceMap";
import ArchiveDialog from "@/components/ArchiveDialog";
import StarRating from "@/components/StarRating";
import { geocodeAddress, reverseGeocodeAddress } from "@/lib/loadGoogleMaps";
import { parseExtraMarkers, hasCoords } from "@/lib/listingUtils";
import { computeBadge as computePriceBadge } from "@/lib/fieldTypes/price";
import { formatCounts } from "@/lib/fieldTypes/count";
import FieldInput from "@/components/FieldInput";
import type { ClientEntry, FieldDef, MapConfig, MapReferencePoint } from "@/lib/types";
import styles from "./EntryCard.module.css";

function toBullets(text: string | null | undefined): string[] {
  return (text || "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}

const MARKER_COLORS = ["#1A73E8", "#EF6C00", "#00897B", "#C2185B", "#5D4037", "#616161"];

function PinIcon() {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={styles.pinIcon}>
      <path d="M12 21s-7-6.1-7-11.5A7 7 0 0 1 19 9.5C19 14.9 12 21 12 21z" />
      <circle cx="12" cy="9.5" r="2.25" fill="currentColor" stroke="none" />
    </svg>
  );
}

// Renders plain text with any http(s) URL inside it turned into a real
// clickable link — used for Notes/Concerns, where someone jotting down
// "check availability: https://..." expects that to be clickable rather
// than sitting there as dead text. Trailing punctuation (a period
// ending the sentence, a closing paren, ...) is kept out of the link
// itself so "see https://example.com." doesn't swallow the period.
function Linkified({ text }: { text: string }) {
  const re = /https?:\/\/[^\s]+/g;
  const parts: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    let url = match[0];
    let end = match.index + url.length;
    const trailingPunct = url.match(/[.,;:!?)\]}'"]+$/);
    if (trailingPunct) {
      url = url.slice(0, -trailingPunct[0].length);
      end -= trailingPunct[0].length;
    }
    if (!url) continue;
    if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index));
    parts.push(
      <a key={match.index} href={url} target="_blank" rel="noopener noreferrer" className={styles.linkifiedLink}>
        {url}
      </a>
    );
    lastIndex = end;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return <>{parts}</>;
}

// The one bulleted-list structure every list on a card builds on —
// Description (plain) and Notes/Concerns (editable, via `renderItem`
// below) always render with this exact same <ul>/<li> markup so they
// look and space identically everywhere.
function BulletList({
  items,
  renderItem,
}: {
  items: string[];
  renderItem?: (item: string, i: number) => ReactNode;
}) {
  if (!items.length) return null;
  return (
    <ul className={styles.bulletList}>
      {items.map((item, i) => (
        <li key={i}>{renderItem ? renderItem(item, i) : item}</li>
      ))}
    </ul>
  );
}

interface EditableNoteListProps {
  items: string[];
  onAdd: ((text: string) => void) | null;
  onRemove: ((i: number) => void) | null;
  addLabel: string;
  placeholder: string;
}

// A BulletList whose items are removable on hover, plus a "+ Add ..."
// affordance that appends a new one via onAdd — used for Notes/
// Concerns. Appending goes through the entries PATCH route's
// appendNote/appendConcern (see that route), the same operation
// whether it's triggered by this button or by asking Claude Desktop to
// add one to an existing entry. `onAdd`/`onRemove` are omitted
// (undefined/null) to drop that capability entirely — used to gate
// add-only invite-link contributors (can add, can't remove) and
// read-only visitors (can't do either) down to the same shared markup.
function EditableNoteList({ items, onAdd, onRemove, addLabel, placeholder }: EditableNoteListProps) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!draft.trim()) return;
    onAdd?.(draft.trim());
    setDraft("");
  }

  return (
    <div className={styles.noteListWrapper}>
      <BulletList
        items={items}
        renderItem={(item, i) =>
          onRemove ? (
            <span className={styles.removableNoteRow}>
              <span>
                <Linkified text={item} />
              </span>
              <button type="button" onClick={() => onRemove(i)} className={styles.removeNoteButton}>
                Remove
              </button>
            </span>
          ) : (
            <Linkified text={item} />
          )
        }
      />
      {onAdd &&
        (adding ? (
          <form onSubmit={submit} className={styles.addNoteForm}>
            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={placeholder}
              className={styles.addNoteInput}
            />
            <button type="submit" className={styles.addNoteSubmit}>
              Add
            </button>
            <button
              type="button"
              onClick={() => {
                setAdding(false);
                setDraft("");
              }}
              className={styles.addNoteCancel}
            >
              Cancel
            </button>
          </form>
        ) : (
          <button type="button" onClick={() => setAdding(true)} className={styles.addNoteTrigger}>
            + {addLabel}
          </button>
        ))}
    </div>
  );
}

interface DraftMarker {
  label: string;
  color: string;
  lat: string | number;
  lng: string | number;
}

interface EntryDraft {
  title: string;
  posterImage: string;
  description: string;
  lat: string | number;
  lng: string | number;
  groupLabel: string;
  extraMarkers: DraftMarker[];
  data: Record<string, string>;
}

export interface EntryCardProps {
  entry: ClientEntry;
  fieldDefs?: FieldDef[];
  mapConfig?: MapConfig;
  onPatch: (id: string, patch: Record<string, unknown>) => void;
  onDelete: (id: string) => void;
  onRate?: (id: string, score: number | null) => void;
  canManage?: boolean;
  canContribute?: boolean;
  bare?: boolean;
  showRank?: boolean;
  showRatings?: boolean;
  showMap?: boolean;
  comparisonMode?: boolean;
  compact?: boolean;
}

export default function EntryCard({
  entry,
  fieldDefs = [],
  mapConfig,
  onPatch,
  onDelete,
  onRate,
  canManage = true,
  canContribute = true,
  bare = false,
  showRank = true,
  showRatings = false,
  showMap = true,
  comparisonMode = true,
  compact = false,
}: EntryCardProps) {
  const [rankDraft, setRankDraft] = useState<string | number>(entry.rank ?? "");
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [showArchiveDialog, setShowArchiveDialog] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState<EntryDraft | null>(null);
  const [address, setAddress] = useState("");
  const [geocoding, setGeocoding] = useState(false);
  const [geocodeMsg, setGeocodeMsg] = useState("");
  const [addressLabel, setAddressLabel] = useState<string | null>(null);
  const isArchived = entry.status === "archived";
  const extraMarkers = parseExtraMarkers(entry.extraMarkers);
  const hasHouse = hasCoords(entry);

  // entry.rank can change for reasons other than this exact input's own
  // edit (another card's edit, a re-fetch after sorting, etc.) — without
  // this, the box would keep showing whatever was last typed/mounted
  // with instead of following the real value.
  useEffect(() => {
    setRankDraft(entry.rank ?? "");
  }, [entry.rank]);

  // Reverse-geocoded once per location for the address line below the
  // title — falls back to a plain "View on map" link (rather than
  // blocking the rest of the card) if it can't resolve.
  useEffect(() => {
    if (!hasHouse) {
      setAddressLabel(null);
      return;
    }
    let cancelled = false;
    reverseGeocodeAddress(entry.lat as number, entry.lng as number)
      .then((addr) => {
        if (!cancelled) setAddressLabel(addr);
      })
      .catch(() => {
        // Non-fatal — the map-pin link below still works via lat/lng.
      });
    return () => {
      cancelled = true;
    };
  }, [hasHouse, entry.lat, entry.lng]);

  const priceFields = fieldDefs.filter((f) => f.field_type === "price");
  const countFields = fieldDefs.filter((f) => f.field_type === "count");
  const countsSummary = formatCounts(countFields.map((f) => ({ fieldDef: f, value: entry[f.key] })));
  // Any boolean field flips on an eyebrow tag when true (e.g. "Closed",
  // "Bar", "Restaurant") — generic by field *type*, not by name, so any
  // boolean field an admin adds to any section gets this for free.
  const activeBooleanFields = fieldDefs.filter((f) => f.field_type === "boolean" && entry[f.key]);

  function archive(reason: string) {
    onPatch(entry.id, { archiveReason: reason, status: "archived" });
    setShowArchiveDialog(false);
  }

  function restore() {
    onPatch(entry.id, { archiveReason: "", status: "active" });
  }

  function commitRank() {
    const n = Number(rankDraft);
    if (!Number.isNaN(n) && n !== entry.rank) {
      onPatch(entry.id, { rank: n });
    }
  }

  function addNote(text: string) {
    onPatch(entry.id, { appendNote: text });
  }

  function removeNoteAt(i: number) {
    const remaining = toBullets(entry.notes).filter((_, idx) => idx !== i);
    onPatch(entry.id, { notes: remaining.join("\n") });
  }

  function addConcern(text: string) {
    onPatch(entry.id, { appendConcern: text });
  }

  function removeConcernAt(i: number) {
    const remaining = toBullets(entry.concerns).filter((_, idx) => idx !== i);
    onPatch(entry.id, { concerns: remaining.join("\n") });
  }

  function startEdit() {
    const dataDraft: Record<string, string> = {};
    fieldDefs.forEach((f) => {
      dataDraft[f.key] = (entry[f.key] as string) ?? "";
    });
    setDraft({
      title: entry.title || "",
      posterImage: entry.posterImage || "",
      description: (entry.description || "").split("\n").filter(Boolean).join("\n"),
      lat: entry.lat ?? "",
      lng: entry.lng ?? "",
      groupLabel: entry.groupLabel || "",
      extraMarkers: extraMarkers.length ? (extraMarkers as unknown as DraftMarker[]) : [],
      data: dataDraft,
    });
    setAddress("");
    setGeocodeMsg("");
    setIsEditing(true);
  }

  async function handleFindCoords() {
    if (!address.trim()) return;
    setGeocoding(true);
    setGeocodeMsg("");
    try {
      const { lat, lng, formattedAddress } = await geocodeAddress(address);
      setDraft((d) => (d ? { ...d, lat: lat.toFixed(6), lng: lng.toFixed(6) } : d));
      setGeocodeMsg(`Found: ${formattedAddress}`);
    } catch (err) {
      setGeocodeMsg((err as Error).message);
    } finally {
      setGeocoding(false);
    }
  }

  function updateDraftMarker(i: number, field: keyof DraftMarker, value: string) {
    if (!draft) return;
    const next = draft.extraMarkers.map((m, idx) => (idx === i ? { ...m, [field]: value } : m));
    setDraft({ ...draft, extraMarkers: next });
  }

  function addDraftMarker() {
    if (!draft) return;
    const color = MARKER_COLORS[draft.extraMarkers.length % MARKER_COLORS.length];
    setDraft({
      ...draft,
      extraMarkers: [...draft.extraMarkers, { label: "", color, lat: "", lng: "" }],
    });
  }

  function removeDraftMarker(i: number) {
    if (!draft) return;
    setDraft({ ...draft, extraMarkers: draft.extraMarkers.filter((_, idx) => idx !== i) });
  }

  function saveEdit() {
    if (!draft) return;
    const cleanMarkers: MapReferencePoint[] = draft.extraMarkers
      .filter((m) => m.label && m.lat !== "" && m.lng !== "")
      .map((m) => ({ label: m.label, color: m.color, lat: Number(m.lat), lng: Number(m.lng) }));

    const dataPatch: Record<string, unknown> = {};
    for (const f of fieldDefs) {
      const v = draft.data[f.key];
      dataPatch[f.key] = f.field_type === "number" || f.field_type === "count" ? (v === "" ? "" : Number(v)) : v;
    }

    onPatch(entry.id, {
      title: draft.title,
      posterImage: draft.posterImage,
      description: draft.description,
      lat: draft.lat === "" ? "" : Number(draft.lat),
      lng: draft.lng === "" ? "" : Number(draft.lng),
      groupLabel: draft.groupLabel || "",
      extraMarkers: cleanMarkers,
      data: dataPatch,
    });
    setIsEditing(false);
    setDraft(null);
  }

  const rootClassName = [styles.article, !bare && styles.framed, isArchived && styles.archived].filter(Boolean).join(" ");
  const mapsSearchUrl = hasHouse ? `https://www.google.com/maps/search/?api=1&query=${entry.lat},${entry.lng}` : undefined;

  return (
    <article id={`listing-${entry.id}`} className={rootClassName}>
      {entry.posterImage && (
        // Compact (2-up) cards get a shorter fixed-height header — a
        // tall/portrait photo used to make its own card noticeably
        // taller than its neighbor sitting right next to it in that
        // grid. Full-width house cards get a tall, edge-to-edge header
        // instead (no side padding — that starts below, in .sections).
        <div className={compact ? styles.mediaHeaderCompact : styles.mediaHeader}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={entry.posterImage} alt={entry.title ?? ""} className={styles.mediaImg} loading="lazy" />
          {showRatings && !!entry.ratingCount && entry.averageScore != null && (
            <div className={styles.scoreBadge} title={`${entry.averageScore.toFixed(1)} avg (${entry.ratingCount})`}>
              {entry.averageScore.toFixed(1)}
            </div>
          )}
        </div>
      )}

      <div className={styles.sections}>
        <div className={styles.section}>
          <div className={styles.utilityRow}>
            {activeBooleanFields.length > 0 ? (
              <div className={styles.eyebrows}>
                {activeBooleanFields.map((f) => (
                  <span key={f.key} className={styles.eyebrow}>
                    {f.label}
                  </span>
                ))}
              </div>
            ) : (
              <span />
            )}
            {showRank && canManage && (
              <div className={styles.rankControl}>
                <label className={styles.rankLabel}>Rank</label>
                <input
                  type="number"
                  value={rankDraft}
                  onChange={(e) => setRankDraft(e.target.value)}
                  onBlur={commitRank}
                  className={styles.rankInput}
                />
              </div>
            )}
          </div>

          <div className={styles.titleRow}>
            <a href={entry.url ?? undefined} target="_blank" rel="noopener noreferrer" className={styles.titleLink}>
              {entry.title}
            </a>
            {priceFields.length > 0 && (
              <div className={styles.priceStack}>
                {priceFields.map((f) => {
                  const value = entry[f.key] as string;
                  const badge = computePriceBadge(value);
                  return value ? (
                    <div key={f.key} className={styles.priceGroup}>
                      <span className={styles.priceAvg}>{badge || value}</span>
                      {badge && <span className={styles.priceTotal}>{value}</span>}
                    </div>
                  ) : (
                    <div key={f.key} className={styles.noPriceLine}>
                      No {f.label.toLowerCase()} yet
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {hasHouse && (
            <a href={mapsSearchUrl} target="_blank" rel="noopener noreferrer" className={styles.addressLink}>
              <PinIcon />
              {addressLabel || "View on map"}
            </a>
          )}

          {showRatings && canContribute && onRate && (
            <div className={styles.userRatingRow}>
              <span className={styles.ratingCaption}>Your score</span>
              <StarRating value={entry.myScore ?? 0} size={18} onChange={(v) => onRate(entry.id, v)} />
              {entry.myScore != null && (
                <button type="button" onClick={() => onRate(entry.id, null)} className={styles.clearScoreButton}>
                  Clear
                </button>
              )}
            </div>
          )}

          {countsSummary && <div className={styles.countsSummary}>{countsSummary}</div>}
        </div>

        {!isEditing && toBullets(entry.description).length > 0 && (
          <div className={styles.section}>
            <h3 className={styles.sectionHeading}>Description</h3>
            <BulletList items={toBullets(entry.description)} />
          </div>
        )}

        {!isEditing && showMap && hasHouse && (
          <div className={styles.section}>
            {comparisonMode ? (
              <ListingMap
                houses={[{ lat: entry.lat as number, lng: entry.lng as number, label: "House (approximate location)" }]}
                extraMarkers={extraMarkers}
                mapConfig={mapConfig}
                showDrivingTimes={showRank}
              />
            ) : (
              <SimplePlaceMap places={[{ lat: entry.lat as number, lng: entry.lng as number, label: entry.title || "Location" }]} />
            )}
          </div>
        )}

        {isEditing && draft && (
          <div className={styles.section}>
            <div className={styles.editGrid}>
              <label className={styles.field}>
                Title
                <input
                  value={draft.title}
                  onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                  className={styles.input}
                />
              </label>
              <label className={styles.field}>
                Photo URL
                <input
                  value={draft.posterImage}
                  onChange={(e) => setDraft({ ...draft, posterImage: e.target.value })}
                  className={styles.input}
                />
              </label>
              <label className={styles.wideField}>
                Description (one bullet per line)
                <textarea
                  value={draft.description}
                  onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                  rows={4}
                  className={styles.input}
                />
              </label>

              {fieldDefs.length > 0 && (
                <div className={styles.fieldDefsGrid}>
                  {fieldDefs.map((f) => (
                    <FieldInput
                      key={f.key}
                      fieldDef={f}
                      value={draft.data[f.key]}
                      onChange={(v) => setDraft({ ...draft, data: { ...draft.data, [f.key]: String(v) } })}
                    />
                  ))}
                  {countFields.length > 0 && (
                    <p className={styles.countHint}>Count fields auto-fill from the description when left blank.</p>
                  )}
                </div>
              )}

              <label className={styles.field}>
                House latitude
                <input
                  value={draft.lat}
                  onChange={(e) => setDraft({ ...draft, lat: e.target.value })}
                  className={styles.input}
                />
              </label>
              <label className={styles.field}>
                House longitude
                <input
                  value={draft.lng}
                  onChange={(e) => setDraft({ ...draft, lng: e.target.value })}
                  className={styles.input}
                />
              </label>
              <div className={styles.wideField}>
                <label>Or find lat/lng from an address</label>
                <div className={styles.geocodeRow}>
                  <input
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="e.g. 45 Ocean Ave, Jonesport, ME"
                    className={styles.geocodeInput}
                  />
                  <button type="button" onClick={handleFindCoords} disabled={geocoding || !address.trim()} className={styles.findButton}>
                    {geocoding ? "Finding..." : "Find"}
                  </button>
                </div>
                {geocodeMsg && <p className={styles.geocodeMsg}>{geocodeMsg}</p>}
              </div>
              <label className={styles.wideField}>
                Group label (optional — only if this is a 2-item option)
                <input
                  value={draft.groupLabel}
                  onChange={(e) => setDraft({ ...draft, groupLabel: e.target.value })}
                  placeholder='e.g. "Jonesport - 2 House Option" (use the exact same text on both)'
                  className={styles.input}
                />
              </label>
            </div>

            <div>
              <div className={styles.markersHeader}>
                <h4 className={styles.markersTitle}>Extra map points (restaurants, hikes, puffin tour, nearest town, etc.)</h4>
                <button type="button" onClick={addDraftMarker} className={styles.addPointButton}>
                  + Add point
                </button>
              </div>
              <div className={styles.markerRowList}>
                {draft.extraMarkers.map((m, i) => (
                  <div key={i} className={styles.markerRow}>
                    <input
                      placeholder="Label"
                      value={m.label}
                      onChange={(e) => updateDraftMarker(i, "label", e.target.value)}
                      className={styles.markerInput}
                    />
                    <input
                      placeholder="Latitude"
                      value={m.lat}
                      onChange={(e) => updateDraftMarker(i, "lat", e.target.value)}
                      className={styles.markerInput}
                    />
                    <input
                      placeholder="Longitude"
                      value={m.lng}
                      onChange={(e) => updateDraftMarker(i, "lng", e.target.value)}
                      className={styles.markerInput}
                    />
                    <input
                      type="color"
                      value={m.color}
                      onChange={(e) => updateDraftMarker(i, "color", e.target.value)}
                      className={styles.markerColorInput}
                    />
                    <button type="button" onClick={() => removeDraftMarker(i)} className={styles.markerRemoveButton}>
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className={styles.editActions}>
              <button onClick={saveEdit} className={styles.saveButton}>
                Save
              </button>
              <button
                onClick={() => {
                  setIsEditing(false);
                  setDraft(null);
                }}
                className={styles.cancelButton}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className={styles.section}>
          <h3 className={styles.sectionHeading}>Notes</h3>
          <EditableNoteList
            items={toBullets(entry.notes)}
            onAdd={canContribute ? addNote : null}
            onRemove={canManage ? removeNoteAt : null}
            addLabel="Add note"
            placeholder="Add a note..."
          />
          <h3 className={styles.concernsHeading}>Concerns</h3>
          <div className={styles.concernsBox}>
            <EditableNoteList
              items={toBullets(entry.concerns)}
              onAdd={canContribute ? addConcern : null}
              onRemove={canManage ? removeConcernAt : null}
              addLabel="Add concern"
              placeholder="Anything that gives you pause..."
            />
          </div>
        </div>

        {canManage && (
          <div className={styles.section}>
            <div className={styles.footer}>
              {!isArchived && (
                <div className={styles.deleteWrapper}>
                  <button onClick={() => setShowArchiveDialog((v) => !v)} className={styles.deleteButton}>
                    Delete
                  </button>
                  {showArchiveDialog && <ArchiveDialog onConfirm={archive} onCancel={() => setShowArchiveDialog(false)} />}
                </div>
              )}

              {!isEditing && (
                <button onClick={startEdit} className={styles.editDetailsButton}>
                  Edit details
                </button>
              )}

              {isArchived && (
                <div className={styles.archivedActions}>
                  {entry.archiveReason && <span className={styles.archiveReason}>{entry.archiveReason}</span>}
                  <button onClick={restore} className={styles.restoreButton}>
                    Restore
                  </button>
                  {confirmingDelete ? (
                    <span className={styles.confirmDeleteRow}>
                      Delete for good?
                      <button onClick={() => onDelete(entry.id)} className={styles.confirmYes}>
                        Yes
                      </button>
                      <button onClick={() => setConfirmingDelete(false)} className={styles.confirmNo}>
                        No
                      </button>
                    </span>
                  ) : (
                    <button onClick={() => setConfirmingDelete(true)} className={styles.deleteButton}>
                      Delete
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </article>
  );
}
