"use client";

import { useEffect, useState } from "react";
import classNames from "classnames";
import StarRating from "@/components/StarRating";
import Button from "@/components/Button";
import { assignBadgeVariants } from "@/components/Badge";
import EntryMedia from "@/components/EntryMedia";
import { useListingMap } from "@/components/ListingMap";
import { fetchForwardGeocode, fetchReverseAddress } from "@/lib/geocodeClient";
import { parseExtraMarkers, hasCoords } from "@/lib/listingUtils";
import { toBullets } from "@/lib/fieldTypes/textarea";
import { isAddressLike } from "./helpers";
import EntryBadgesRow from "./components/EntryBadgesRow";
import PriceDisplay from "./components/PriceDisplay";
import CountsRow, { type CountRow } from "./components/CountsRow";
import OverviewFieldsRow, { type OverviewFieldRow } from "./components/OverviewFieldsRow";
import EntryDescription from "./components/EntryDescription";
import VisitedControl from "./components/VisitedControl";
import LocationSection from "./components/LocationSection";
import EntryEditForm, { type EntryDraft } from "./components/EntryEditForm";
import EditableNoteList from "./components/EditableNoteList";
import EntryFooter from "./components/EntryFooter";
import type { ClientEntry, FieldDef, MapConfig, MapReferencePoint } from "@/lib/types";
import styles from "./EntryCard.module.css";

export interface EntryCardProps {
  entry: ClientEntry;
  fieldDefs?: FieldDef[];
  mapConfig?: MapConfig;
  /** For the address line's reverse-geocode + useListingMap's own
   * town/driving-time lookups (see lib/geocodeClient.ts/lib/routeClient.ts)
   * — every real caller has one; optional in the type only so a bare/
   * detached usage without a real trip context (none currently exist)
   * doesn't have to fabricate one. Without it, those lookups just
   * silently skip. */
  tripSlug?: string;
  onPatch: (id: string, patch: Record<string, unknown>) => void;
  onDelete: (id: string) => void;
  onRate?: (id: string, score: number | null) => void;
  canManage?: boolean;
  canContribute?: boolean;
  bare?: boolean;
  showRatings?: boolean;
  showMap?: boolean;
  comparisonMode?: boolean;
  compact?: boolean;
  /** Houses' own cards get a taller photo — see EntryMedia's own
   * `large` prop, which this just forwards to. */
  largeMedia?: boolean;
  /** The "small card, two per row" layout's own photo height — see
   * EntryMedia's own `medium` prop, which this just forwards to. */
  mediumMedia?: boolean;
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
   * supports_pairing) — gates the "+ Add paired option" button and the
   * edit form's Group label field, only ever shown on a solo card
   * (hideMedia is only ever true for an already-paired card, which
   * doesn't need this). */
  supportsPairing?: boolean;
  /** Opens SectionPage's PairEntryDialog for this entry specifically. */
  onAddPaired?: () => void;
  /** The trip's real length (date range) or estimated one (see
   * lib/fieldTypes/price.ts's computeTripNights) — passed through to
   * FieldInput's own price editor (as tripNights) so its "total for
   * stay" mode can bake a real "for N nights" into what gets stored
   * the moment a price is entered, instead of leaving that to be
   * guessed later. */
  nightsEstimate?: number | null;
  /** Whether to show the Stayed/Visited control at all — only
   * meaningful once the trip is actually over (trip.completed); a
   * still-Pending trip has nothing to have visited yet. */
  showVisitedControl?: boolean;
}

export default function EntryCard({
  entry,
  fieldDefs = [],
  mapConfig,
  tripSlug,
  onPatch,
  onDelete,
  onRate,
  canManage = true,
  canContribute = true,
  bare = false,
  showRatings = false,
  showMap = true,
  comparisonMode = true,
  compact = false,
  largeMedia = false,
  mediumMedia = false,
  hideMedia = false,
  showRatingControl = true,
  supportsPairing = false,
  onAddPaired,
  nightsEstimate = null,
  showVisitedControl = false,
}: EntryCardProps) {
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
  // deciding-among-house-options list — identified by ratings being on
  // (the manual Rank toggle this used to also key off of is retired).
  const showHouseDetails = showRatings;
  // Called unconditionally (Rules of Hooks) — `enabled` lets it no-op
  // entirely (skip loading Google Maps, skip every effect) for a card
  // that won't actually show a comparison map (editing, no coords, or a
  // section that just wants the plain SimplePlaceMap instead).
  const listingMapData = useListingMap({
    houses: hasHouse ? [{ lat: entry.lat as number, lng: entry.lng as number, label: entry.title || "Location" }] : [],
    extraMarkers,
    mapConfig,
    showReferencePoints: showHouseDetails,
    enabled: comparisonMode && hasHouse && showMap && !isEditing,
    tripSlug,
  });

  // Reverse-geocoded once per location for the address line below the
  // title — falls back to a plain "View on map" link (rather than
  // blocking the rest of the card) if it can't resolve.
  useEffect(() => {
    if (!hasHouse || !tripSlug) {
      setAddressLabel(null);
      return;
    }
    let cancelled = false;
    fetchReverseAddress(tripSlug, entry.lat as number, entry.lng as number)
      .then((result) => {
        if (!cancelled) setAddressLabel(result?.formattedAddress ?? null);
      })
      .catch(() => {
        // Non-fatal — the map-pin link below still works via lat/lng.
      });
    return () => {
      cancelled = true;
    };
  }, [hasHouse, entry.lat, entry.lng, tripSlug]);

  const priceFields = fieldDefs.filter((f) => f.field_type === "price");
  const countFields = fieldDefs.filter((f) => f.field_type === "count");
  const countRows: CountRow[] = countFields
    .map((f) => ({ fieldDef: f, value: entry[f.key] }))
    .filter(({ value }) => value !== "" && value !== null && value !== undefined);
  // Any other "show on overview" field (text/url/select/date/... — a
  // phone number, a website, whatever an admin adds) that isn't already
  // handled by one of the dedicated displays above — see
  // OverviewFieldsRow, which previously had nowhere to render at all.
  const overviewRows: OverviewFieldRow[] = fieldDefs
    .filter((f) => f.show_on_overview && !["price", "count", "boolean"].includes(f.field_type))
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
  // up. "closed" is excluded since it always gets its own dedicated
  // variant, never one of the arbitrary rotation colors.
  const badgeVariants = assignBadgeVariants(
    fieldDefs.filter((f) => f.field_type === "boolean" && f.key !== "closed").map((f) => f.key)
  );

  function addNote(text: string) {
    onPatch(entry.id, { appendNote: text });
  }

  function removeNoteAt(i: number) {
    onPatch(entry.id, { notes: toBullets(entry.notes).filter((_, idx) => idx !== i).join("\n") });
  }

  function addConcern(text: string) {
    onPatch(entry.id, { appendConcern: text });
  }

  function removeConcernAt(i: number) {
    onPatch(entry.id, { concerns: toBullets(entry.concerns).filter((_, idx) => idx !== i).join("\n") });
  }

  function startEdit() {
    const dataDraft: Record<string, string> = {};
    fieldDefs.forEach((f) => {
      dataDraft[f.key] = (entry[f.key] as string) ?? "";
    });
    setDraft({
      title: entry.title || "",
      url: entry.url || "",
      posterImage: entry.posterImage || "",
      description: (entry.description || "").split("\n").filter(Boolean).join("\n"),
      lat: entry.lat ?? "",
      lng: entry.lng ?? "",
      groupLabel: entry.groupLabel || "",
      extraMarkers: extraMarkers.length ? (extraMarkers as unknown as EntryDraft["extraMarkers"]) : [],
      data: dataDraft,
    });
    setAddress("");
    setGeocodeMsg("");
    setIsEditing(true);
  }

  async function handleFindCoords() {
    if (!address.trim() || !tripSlug) return;
    setGeocoding(true);
    setGeocodeMsg("");
    try {
      const { lat, lng, formattedAddress } = await fetchForwardGeocode(tripSlug, address);
      setDraft((d) => (d ? { ...d, lat: lat.toFixed(6), lng: lng.toFixed(6) } : d));
      setGeocodeMsg(`Found: ${formattedAddress}`);
    } catch (err) {
      setGeocodeMsg((err as Error).message);
    } finally {
      setGeocoding(false);
    }
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
      url: draft.url || null,
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

  function archive(reason: string) {
    onPatch(entry.id, { archiveReason: reason, status: "archived" });
  }

  function restore() {
    onPatch(entry.id, { archiveReason: "", status: "active" });
  }

  const rootClassName = classNames(styles["root"], !bare && styles["framed"], isArchived && styles["archived"]);
  // On a split/paired card (bare + hideMedia, inside GroupMap's own
  // ListingSection), this top border would just double up whatever
  // divider that wrapping context already draws above it.
  const sectionsClassName = classNames(styles["sections"], bare && styles["sections-bare"]);
  const mapsSearchUrl = hasHouse ? `https://www.google.com/maps/search/?api=1&query=${entry.lat},${entry.lng}` : undefined;

  return (
    <article id={`listing-${entry.id}`} className={rootClassName}>
      {/* Previously just a small italic line down in the footer next to
          Restore/Delete — confirmed live as easy to miss entirely,
          especially on a tall card. A full-width banner right at the
          top says why this was ruled out before anything else about
          the card even loads. */}
      {isArchived && entry.archiveReason && <div className={styles["archive-banner"]}>Archived: {entry.archiveReason}</div>}

      {!hideMedia && (
        <EntryMedia entry={entry} compact={compact} large={largeMedia} medium={mediumMedia} showRatings={showRatings} />
      )}

      <div className={sectionsClassName}>
        <div className={styles["section"]}>
          {activeBooleanFields.length > 0 && (
            <EntryBadgesRow activeBooleanFields={activeBooleanFields} badgeVariants={badgeVariants} />
          )}

          <div className={styles["header-grid"]}>
            <div className={styles["title-column"]}>
              <a href={entry.url ?? undefined} target="_blank" rel="noopener noreferrer" className={styles["title-link"]}>
                {entry.title}
              </a>
              {hasHouse && (
                <a href={mapsSearchUrl} target="_blank" rel="noopener noreferrer" className={styles["address-link"]}>
                  {addressLabel || "View on map"}
                </a>
              )}
            </div>
            <PriceDisplay entry={entry} priceFields={priceFields} />
          </div>

          {showRatingControl && showRatings && canContribute && onRate && (
            <div className={styles["user-rating-row"]}>
              <span className={styles["rating-caption"]}>Your score</span>
              <StarRating value={entry.myScore ?? 0} size={18} onChange={(v) => onRate(entry.id, v)} />
              {entry.myScore != null && (
                <Button variant="ghost" size="sm" onClick={() => onRate(entry.id, null)} className={styles["clear-score"]}>
                  Clear
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Its own section, horizontal — bedrooms/beds/bathrooms read as
            a quick-scan strip rather than being crammed into the price
            column or a slash-joined sentence. */}
        {countRows.length > 0 && (
          <div className={styles["section"]}>
            <CountsRow countRows={countRows} />
          </div>
        )}

        {/* Everything else marked "show on overview" (phone, website,
            ...) that has no dedicated display of its own. */}
        {overviewRows.length > 0 && (
          <div className={styles["section"]}>
            <OverviewFieldsRow rows={overviewRows} />
          </div>
        )}

        {!isEditing && (
          <div className={styles["section"]}>
            <EntryDescription bullets={descriptionBullets} />
          </div>
        )}

        {canManage && !isArchived && showVisitedControl && (
          <div className={styles["section"]}>
            <VisitedControl entry={entry} supportsPairing={supportsPairing} onPatch={onPatch} />
          </div>
        )}

        {!isEditing && showMap && hasHouse && (
          <LocationSection entry={entry} comparisonMode={comparisonMode} listingMapData={listingMapData} />
        )}

        {isEditing && draft && (
          <div className={styles["section"]}>
            <EntryEditForm
              draft={draft}
              onChange={setDraft}
              fieldDefs={fieldDefs}
              nightsEstimate={nightsEstimate}
              supportsPairing={supportsPairing}
              address={address}
              onAddressChange={setAddress}
              geocoding={geocoding}
              geocodeMsg={geocodeMsg}
              onFindCoords={handleFindCoords}
            />
          </div>
        )}

        {/* Its own section, same as every other content block — not
            bundled with Concerns under one shared heading-pair anymore. */}
        {(hasNotes || canContribute) && (
          <div className={styles["section"]}>
            <h3 className={styles["section-heading"]}>Notes</h3>
            <EditableNoteList
              items={toBullets(entry.notes)}
              onAdd={canContribute ? addNote : null}
              onRemove={canContribute ? removeNoteAt : null}
              addLabel="Add note"
              placeholder="Add a note..."
            />
          </div>
        )}

        {/* The whole section gets the amber tint now, not just a box
            wrapped around the list inside a plain section. */}
        {(hasConcerns || canContribute) && (
          <div className={styles["concerns-section"]}>
            <h3 className={styles["concerns-heading"]}>Concerns</h3>
            <EditableNoteList
              items={toBullets(entry.concerns)}
              onAdd={canContribute ? addConcern : null}
              onRemove={canContribute ? removeConcernAt : null}
              addLabel="Add concern"
              placeholder="Anything that gives you pause..."
            />
          </div>
        )}

        {/* A contributor (invite-link) gets edit/archive/restore here
            too, not just admins — canManage (admin-only) instead just
            gates the real permanent-delete actions inside, via
            canDelete. See requireWriteAccess's allowContributor on the
            entries PATCH route for the matching server-side check. */}
        {canContribute && (
          <div className={styles["section"]}>
            <EntryFooter
              entry={entry}
              supportsPairing={supportsPairing}
              isEditing={isEditing}
              hideMedia={hideMedia}
              canDelete={canManage}
              onArchive={archive}
              onDelete={onDelete}
              onRestore={restore}
              onStartEdit={startEdit}
              onSaveEdit={saveEdit}
              onCancelEdit={() => {
                setIsEditing(false);
                setDraft(null);
              }}
              onAddPaired={onAddPaired}
            />
          </div>
        )}
      </div>
    </article>
  );
}
