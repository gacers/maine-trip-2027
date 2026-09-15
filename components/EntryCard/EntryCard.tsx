"use client";

import { useEffect, useState, type ReactNode, type FormEvent } from "react";
import { BedDouble, BedSingle, Bath, Hash } from "lucide-react";
import { ListingMapView, useListingMap } from "@/components/ListingMap";
import ListingMapDetails from "@/components/ListingMapDetails";
import SimplePlaceMap from "@/components/SimplePlaceMap";
import ArchiveDialog from "@/components/ArchiveDialog";
import StarRating from "@/components/StarRating";
import Button from "@/components/Button";
import Badge, { assignBadgeVariants } from "@/components/Badge";
import EntryMedia from "@/components/EntryMedia";
import BulletList from "@/components/BulletList";
import { geocodeAddress, reverseGeocodeAddress } from "@/lib/loadGoogleMaps";
import { parseExtraMarkers, hasCoords } from "@/lib/listingUtils";
import { computeBadge as computePriceBadge } from "@/lib/fieldTypes/price";
import FieldInput from "@/components/FieldInput";
import type { ClientEntry, FieldDef, MapConfig, MapReferencePoint } from "@/lib/types";
import styles from "./EntryCard.module.css";

function toBullets(text: string | null | undefined): string[] {
  return (text || "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}

// A raw street address ("9 Thurston Rd, Bernard, ME 04612, USA") ending
// up as the whole description — the Google Places fallback used to do
// exactly this whenever a place had no editorial summary (see
// AddEntryForm's choosePlace) — isn't real descriptive content; the
// address is already covered by the address line below the title, so a
// line that's just that reads as a broken/duplicated field, not a
// description. Filtered out here (rather than at save time) so it also
// catches entries added before that fallback was fixed.
const US_ADDRESS_RE = /,\s*[A-Z]{2}\s*\d{5}(-\d{4})?(,\s*(USA|United States))?\s*$/;
function isAddressLike(line: string): boolean {
  return US_ADDRESS_RE.test(line.trim());
}

const MARKER_COLORS = ["#1A73E8", "#EF6C00", "#00897B", "#C2185B", "#5D4037", "#616161"];

// A count field's label is stored plural ("Bedrooms", "Beds",
// "Bathrooms") since that's how it reads in the field-defs admin UI and
// in the count summary for the common >1 case — singularized here only
// for display when the actual value is exactly 1 ("1 Bedroom", not
// "1 Bedrooms"). Simple heuristic covers every count field in use today;
// good enough for whatever an admin invents later too.
function singularizeCountLabel(label: string, value: unknown): string {
  if (Number(value) !== 1) return label;
  if (/ies$/i.test(label)) return label.replace(/ies$/i, "y");
  if (/s$/i.test(label)) return label.replace(/s$/i, "");
  return label;
}

// Picks a purpose-built icon by matching words in the field's own label —
// generic count fields with an unrecognized label (anything an admin
// might invent later) still get a sensible fallback rather than nothing.
function countFieldIcon(label: string) {
  const l = label.toLowerCase();
  if (l.includes("bath")) return <Bath size={17} className={styles.countIcon} />;
  if (l.includes("bedroom")) return <BedDouble size={17} className={styles.countIcon} />;
  if (l.includes("bed")) return <BedSingle size={17} className={styles.countIcon} />;
  return <Hash size={17} className={styles.countIcon} />;
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
      {items.length > 0 && (
        <BulletList>
          {items.map((item, i) => (
            <li key={i}>
              {onRemove ? (
                <span className={styles.removableNoteRow}>
                  <span>
                    <Linkified text={item} />
                  </span>
                  <Button variant="ghost" size="sm" onClick={() => onRemove(i)} className={styles.removeNoteButton}>
                    Remove
                  </Button>
                </span>
              ) : (
                <Linkified text={item} />
              )}
            </li>
          ))}
        </BulletList>
      )}
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
            <Button type="submit" variant="link" size="sm">
              Add
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setAdding(false);
                setDraft("");
              }}
            >
              Cancel
            </Button>
          </form>
        ) : (
          <Button variant="link" size="sm" className={styles.addNoteTrigger} onClick={() => setAdding(true)}>
            + {addLabel}
          </Button>
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
  /** Houses' own cards get a taller photo — see EntryMedia's own
   * `large` prop, which this just forwards to. */
  largeMedia?: boolean;
  /** Skip rendering this card's own photo — used for a 2-house-option
   * group, where SectionPage lays both houses' photos out as their own
   * row (via EntryMedia directly) above the group's shared title
   * section, ahead of each house's own remaining content. */
  hideMedia?: boolean;
  /** Skip this card's own "Your score" input — used for a 2-house-
   * option group, which gets one shared rating control on ListingSection's
   * own title bar instead of one per half (a pair is rated as one
   * option, not twice). showRatings still governs the average-score
   * badge on this card's own photo either way. */
  showRatingControl?: boolean;
  /** Whether this section supports 2-item pairing at all (section.
   * supports_pairing) — gates the "+ Add paired option" button below,
   * only ever shown on a solo card (hideMedia is only ever true for an
   * already-paired card, which doesn't need this). */
  supportsPairing?: boolean;
  /** Opens SectionPage's PairEntryDialog for this entry specifically. */
  onAddPaired?: () => void;
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
  largeMedia = false,
  hideMedia = false,
  showRatingControl = true,
  supportsPairing = false,
  onAddPaired,
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
  // Reference points/Closest Town/Driving Times are for a still-
  // deciding-among-house-options list — today that's identified by
  // *either* scoring mechanism being on (showRank for a manual-rank
  // section, showRatings for Possible Houses' now-retired-ranking/
  // ratings-driven one), not showRank alone: that went stale the
  // moment manual ranking got retired here in favor of ratings, which
  // silently turned this whole section off for House Options.
  const showHouseDetails = showRank || showRatings;
  // Called unconditionally (Rules of Hooks) — `enabled` lets it no-op
  // entirely (skip loading Google Maps, skip every effect) for a card
  // that won't actually show a comparison map (editing, no coords, or a
  // section that just wants the plain SimplePlaceMap instead). Feeds
  // both ListingMapView and ListingMapDetails below so there's still
  // only one Google Maps instance/Directions calls behind both of this
  // card's map sections.
  const listingMapData = useListingMap({
    houses: hasHouse ? [{ lat: entry.lat as number, lng: entry.lng as number, label: entry.title || "Location" }] : [],
    extraMarkers,
    mapConfig,
    showReferencePoints: showHouseDetails,
    enabled: comparisonMode && hasHouse && showMap && !isEditing,
  });

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
  const countRows = countFields
    .map((f) => ({ fieldDef: f, value: entry[f.key] }))
    .filter(({ value }) => value !== "" && value !== null && value !== undefined);
  const descriptionBullets = toBullets(entry.description).filter((line) => !isAddressLike(line));
  const hasNotes = toBullets(entry.notes).length > 0;
  const hasConcerns = toBullets(entry.concerns).length > 0;
  // Any boolean field flips on an eyebrow tag when true (e.g. "Closed",
  // "Bar", "Restaurant") — generic by field *type*, not by name, so any
  // boolean field an admin adds to any section gets this for free.
  const activeBooleanFields = fieldDefs.filter((f) => f.field_type === "boolean" && entry[f.key]);
  // Colors are assigned from the section's full boolean field list (not
  // just this entry's active ones), in that list's own defined order —
  // so a given type always lands on the same color everywhere it shows
  // up, and two different types in the same section never collide the
  // way an independent per-key hash could. "closed" is excluded here
  // since it always gets its own dedicated variant below, never one of
  // the arbitrary rotation colors.
  const badgeVariants = assignBadgeVariants(
    fieldDefs.filter((f) => f.field_type === "boolean" && f.key !== "closed").map((f) => f.key)
  );

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
  // On a split/paired card (bare + hideMedia, inside GroupMap's own
  // ListingSection), this top border would just double up whatever
  // divider that wrapping context already draws above it.
  const sectionsClassName = [styles.sections, bare && styles.sectionsBare].filter(Boolean).join(" ");
  const mapsSearchUrl = hasHouse ? `https://www.google.com/maps/search/?api=1&query=${entry.lat},${entry.lng}` : undefined;

  return (
    <article id={`listing-${entry.id}`} className={rootClassName}>
      {!hideMedia && <EntryMedia entry={entry} compact={compact} large={largeMedia} showRatings={showRatings} />}

      <div className={sectionsClassName}>
        <div className={styles.section}>
          {(activeBooleanFields.length > 0 || (showRank && canManage)) && (
            <div className={styles.utilityRow}>
              {activeBooleanFields.length > 0 && (
                <div className={styles.eyebrows}>
                  {activeBooleanFields.map((f) => (
                    <Badge key={f.key} variant={f.key === "closed" ? "closed" : badgeVariants[f.key]}>
                      {f.label}
                    </Badge>
                  ))}
                </div>
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
          )}

          <div className={styles.headerGrid}>
            <div className={styles.titleColumn}>
              <a href={entry.url ?? undefined} target="_blank" rel="noopener noreferrer" className={styles.titleLink}>
                {entry.title}
              </a>
              {hasHouse && (
                <a href={mapsSearchUrl} target="_blank" rel="noopener noreferrer" className={styles.addressLink}>
                  {addressLabel || "View on map"}
                </a>
              )}
            </div>

            {priceFields.length > 0 && (
              <div className={styles.priceStack}>
                {priceFields.map((f) => {
                  const value = entry[f.key] as string;
                  const badge = computePriceBadge(value);
                  return value ? (
                    <div key={f.key} className={styles.priceGroup}>
                      {/* The total is what actually matters when
                          comparing options — the per-night average is
                          useful context, not the headline number. */}
                      <span className={styles.priceTotal}>{value}</span>
                      {badge && <span className={styles.priceAvg}>{badge}</span>}
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

          {showRatingControl && showRatings && canContribute && onRate && (
            <div className={styles.userRatingRow}>
              <span className={styles.ratingCaption}>Your score</span>
              <StarRating value={entry.myScore ?? 0} size={18} onChange={(v) => onRate(entry.id, v)} />
              {entry.myScore != null && (
                <Button variant="ghost" size="sm" onClick={() => onRate(entry.id, null)} className={styles.clearScoreButton}>
                  Clear
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Its own section, horizontal — bedrooms/beds/bathrooms read as
            a quick-scan strip rather than being crammed into the price
            column or a slash-joined sentence. Skipped entirely when the
            section has no count-type fields defined or none are filled in. */}
        {countRows.length > 0 && (
          <div className={styles.section}>
            <BulletList bulleted={false} className={styles.countsRow}>
              {countRows.map(({ fieldDef, value }) => (
                <li key={fieldDef.key} className={styles.countItem}>
                  {countFieldIcon(fieldDef.label)}
                  <span>
                    {value as ReactNode} {singularizeCountLabel(fieldDef.options?.shortLabel || fieldDef.label, value)}
                  </span>
                </li>
              ))}
            </BulletList>
          </div>
        )}

        {!isEditing && descriptionBullets.length > 0 && (
          <div className={styles.section}>
            <h3 className={styles.sectionHeading}>Description</h3>
            <BulletList>
              {descriptionBullets.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </BulletList>
          </div>
        )}

        {!isEditing && showMap && hasHouse && (
          <>
            <div className={styles.section}>
              {comparisonMode ? (
                <ListingMapView {...listingMapData} />
              ) : (
                <SimplePlaceMap places={[{ lat: entry.lat as number, lng: entry.lng as number, label: entry.title || "Location" }]} />
              )}
            </div>
            {/* Its own section, not bundled into the map's — Closest
                Town/Driving Times are a distinct concern from "here's
                the map". Skipped entirely (not just left empty) when
                there's genuinely nothing to show, e.g. a non-ranking
                section with no resolved closest town yet either. */}
            {comparisonMode && (listingMapData.closestTown || listingMapData.showReferencePoints) && (
              <div className={styles.section}>
                <ListingMapDetails {...listingMapData} />
              </div>
            )}
          </>
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
                Latitude
                <input
                  value={draft.lat}
                  onChange={(e) => setDraft({ ...draft, lat: e.target.value })}
                  className={styles.input}
                />
              </label>
              <label className={styles.field}>
                Longitude
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
                  <Button variant="secondary" size="sm" onClick={handleFindCoords} disabled={geocoding || !address.trim()}>
                    {geocoding ? "Finding..." : "Find"}
                  </Button>
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
                <Button variant="link" size="sm" onClick={addDraftMarker}>
                  + Add point
                </Button>
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
                    <Button variant="danger" size="sm" onClick={() => removeDraftMarker(i)}>
                      Remove
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Its own section, same as every other content block — not
            bundled with Concerns under one shared heading-pair anymore. */}
        {(hasNotes || canContribute) && (
          <div className={styles.section}>
            <h3 className={styles.sectionHeading}>Notes</h3>
            <EditableNoteList
              items={toBullets(entry.notes)}
              onAdd={canContribute ? addNote : null}
              onRemove={canManage ? removeNoteAt : null}
              addLabel="Add note"
              placeholder="Add a note..."
            />
          </div>
        )}

        {/* The whole section gets the amber tint now, not just a box
            wrapped around the list inside a plain section. */}
        {(hasConcerns || canContribute) && (
          <div className={styles.concernsSection}>
            <h3 className={styles.concernsHeading}>Concerns</h3>
            <EditableNoteList
              items={toBullets(entry.concerns)}
              onAdd={canContribute ? addConcern : null}
              onRemove={canManage ? removeConcernAt : null}
              addLabel="Add concern"
              placeholder="Anything that gives you pause..."
            />
          </div>
        )}

        {canManage && (
          <div className={styles.section}>
            <div className={styles.footer}>
              {!isArchived && (
                <div className={styles.deleteWrapper}>
                  <Button variant="danger" size="sm" onClick={() => setShowArchiveDialog(true)}>
                    Delete
                  </Button>
                  <ArchiveDialog open={showArchiveDialog} onOpenChange={setShowArchiveDialog} onConfirm={archive} />
                </div>
              )}

              {!isEditing ? (
                <Button variant="ghost" size="sm" onClick={startEdit}>
                  Edit details
                </Button>
              ) : (
                <>
                  <Button variant="primary" size="sm" onClick={saveEdit}>
                    Save
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setIsEditing(false);
                      setDraft(null);
                    }}
                  >
                    Cancel
                  </Button>
                </>
              )}

              {!hideMedia && !isArchived && !isEditing && supportsPairing && onAddPaired && (
                <Button variant="ghost" size="sm" onClick={onAddPaired}>
                  + Add paired option
                </Button>
              )}

              {isArchived && (
                <div className={styles.archivedActions}>
                  {entry.archiveReason && <span className={styles.archiveReason}>{entry.archiveReason}</span>}
                  <Button variant="link" size="sm" onClick={restore}>
                    Restore
                  </Button>
                  {confirmingDelete ? (
                    <span className={styles.confirmDeleteRow}>
                      Delete for good?
                      <Button variant="danger" size="sm" onClick={() => onDelete(entry.id)}>
                        Yes
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setConfirmingDelete(false)}>
                        No
                      </Button>
                    </span>
                  ) : (
                    <Button variant="danger" size="sm" onClick={() => setConfirmingDelete(true)}>
                      Delete
                    </Button>
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
