// Shared domain shapes — mirrors the Supabase row shapes (snake_case)
// and the client-flattened shapes lib/entries.js's toClientEntry
// produces (camelCase), used across components/pages/API routes.

export type FieldType =
  | "text"
  | "textarea"
  | "url"
  | "image_url"
  | "number"
  | "count"
  | "price"
  | "select"
  | "boolean"
  | "date";

export interface FieldDef {
  id: string;
  section_id: string;
  key: string;
  label: string;
  field_type: FieldType;
  storage: "core" | "jsonb";
  core_column?: string | null;
  show_on_overview: boolean;
  required: boolean;
  options?: { choices?: string[]; aliases?: string[]; shortLabel?: string } | null;
  sort_order: number;
}

export interface Section {
  id: string;
  trip_id: string;
  nav_group_id: string | null;
  slug: string;
  label: string;
  sub_nav_label: string | null;
  add_placeholder: string | null;
  empty_message: string | null;
  supports_pairing: boolean;
  has_map: boolean;
  supports_ratings: boolean;
  /** @deprecated superseded by card_layout (migration 0017) — left in
   * place on the row/type but no longer read anywhere in the app. */
  compact_cards: boolean;
  /** How this section's entries lay out: one full-width card per row,
   * two full-width cards per row, or the tighter 3-across compact grid
   * (the old compact_cards=true). */
  card_layout: "list" | "grid-2" | "grid-3";
  enabled: boolean;
  sort_order: number;
  /** This section's own tab's Google-assigned numeric sheetId within
   * the trip's shared spreadsheet — null until its first export (see
   * lib/sheetsExport.ts's ensureTab). Lets the site's own "Google
   * Sheet" link jump straight to the right tab via #gid=<sheet_gid>. */
  sheet_gid: number | null;
  /** Message from this section's last Sheet-export attempt, or null if
   * it succeeded (or has never run) — see lib/sheetsExport.ts. Every
   * write triggers a best-effort export that used to swallow a real
   * failure with nothing but a server-side console.error; this is what
   * lets the UI actually show an admin that their Sheet fell out of
   * sync. */
  sheet_sync_error: string | null;
  field_defs?: FieldDef[];
}

export interface NavGroup {
  id: string;
  trip_id: string;
  slug: string;
  label: string;
  sort_order: number;
  sections: Section[];
}

// A bare point — a house, a paired listing, or anything else placed on
// a map with nothing more than where it is and what to call it.
export interface LatLngLabel {
  lat: number;
  lng: number;
  label: string;
}

// One render unit's pin for OverviewMap — a paired 2-item group
// collapses to a single pin (see SectionPage's pinFor).
export interface OverviewPin {
  anchor: string;
  label: string | null | undefined;
  lat: number | null;
  lng: number | null;
}

export interface MapReferencePoint {
  lat: number;
  lng: number;
  label: string;
  color: string;
  closestLabel?: string;
  joinClosestOf?: boolean;
}

export interface MapConfig {
  alwaysShown?: MapReferencePoint[];
  closestOf?: MapReferencePoint[];
  originLabel?: string;
  houseColor?: string;
  townColor?: string;
}

export interface Trip {
  id: string;
  slug: string;
  name: string;
  subtitle?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  /** A fallback date range — for when the primary dates above might
   * not pan out (availability, price, ...) and there's a real backup
   * week already in mind. Independent of start_date/end_date; either
   * pair can be set without the other. See lib/listingAvailability.ts,
   * which appends whichever range(s) are set to a Stay Option's own
   * Airbnb/VRBO link so its availability there is one click away. */
  alt_start_date?: string | null;
  alt_end_date?: string | null;
  /** Fallback trip length when there's no real start_date+end_date
   * range yet — lets a price field's own lone total (no stated "/
   * night" or "for N nights") still resolve to a useful avg/night
   * instead of being ambiguous (see lib/fieldTypes/price.ts). */
  nights_estimate?: number | null;
  /** The trips-index card's own full-bleed background photo (see
   * TripSettingsForm) — a plain pasted URL, not derived from any
   * entry's own photo. */
  cover_image?: string | null;
  /** Country / region label for cross-trip catalog filters (e.g.
   * "United States", "Scotland") — set in Trip Settings. */
  country?: string | null;
  /** Set once the trip has actually happened and been reviewed — drives
   * the trips index's Pending/Past split (past = completed OR its own
   * dates have already passed, see app/page.tsx) and gates the
   * "Archive unvisited" nav action (see ArchiveUnvisitedButton). */
  completed: boolean;
  map_config: MapConfig;
  google_sheet_id?: string | null;
  google_sheet_url?: string | null;
  // See supabase/migrations/0024_trip_itinerary_doc.sql — same
  // lazily-created-on-first-export shape as google_sheet_id/_url.
  google_itinerary_doc_id?: string | null;
  google_itinerary_doc_url?: string | null;
  // See supabase/migrations/0031_trip_drive_folder.sql — the Drive
  // subfolder (inside the app-wide shared folder) this trip's own
  // Sheet + itinerary Doc live in, created lazily by
  // lib/drive.ts's getOrCreateTripFolder.
  google_drive_folder_id?: string | null;
  archived: boolean;
  // Admin-only secrets — present on the raw row, stripped by
  // sanitizeTripForClient before reaching a Client Component or a
  // public API response.
  sheet_invite_token?: string | null;
  sheet_invite_key_id?: string | null;
}

// A trip row as it reaches a Client Component/public response — see
// lib/sections.ts's sanitizeTripForClient.
export type PublicTrip = Omit<
  Trip,
  | "sheet_invite_token"
  | "sheet_invite_key_id"
  | "google_sheet_url"
  | "google_sheet_id"
  | "google_itinerary_doc_id"
  | "google_itinerary_doc_url"
  | "google_drive_folder_id"
>;

export type EntryStatus = "active" | "archived";

// The client-flattened shape (lib/entries.ts's toClientEntry): core
// columns camelCased, plus every section-specific field_def key spread
// to the top level, plus (only when the section supports ratings) the
// summarized rating fields.
export interface ClientEntry {
  id: string;
  sectionId: string;
  tripId: string;
  rank: number | null;
  status: EntryStatus;
  archiveReason: string;
  notes: string | null;
  concerns: string | null;
  title: string | null;
  url: string | null;
  posterImage: string | null;
  description: string | null;
  lat: number | null;
  lng: number | null;
  /** Place region — reverse-geocoded from lat/lng (US state or country),
   * falling back to the trip's country. Hidden from the UI; used by
   * Categories / Future Interest filters. */
  country: string | null;
  extraMarkers: MapReferencePoint[];
  groupLabel: string;
  createdAt: string;
  updatedAt: string;
  /** "Stayed here" (Stay Options) / "Visited" (everywhere else) — set
   * once a trip is completed and this entry is checked off as an
   * actual part of what happened, as opposed to an option that never
   * got used (see ArchiveUnvisitedButton). Universal across every
   * section, not just Stay Options. */
  visited: boolean;
  visitedDate: string | null;
  /** See EntryRow's own comment — set once this entry syncs from
   * another one; its shared fields are read-only here. */
  importSourceEntryId: string | null;
  averageScore?: number | null;
  ratingCount?: number;
  myScore?: number | null;
  // Section-specific field_def values (price, bedrooms, Closed, ...),
  // keyed by each field's own `key` — genuinely dynamic per section.
  [fieldKey: string]: unknown;
}

// lib/groupUnits.ts's pairing result: a solo entry, or two entries
// sharing a groupLabel rendered as one card/map/rank.
export type EntryUnit =
  | { type: "solo"; listings: [ClientEntry] }
  | { type: "group"; listings: [ClientEntry, ClientEntry] };

// The raw `entries` row shape (snake_case), before lib/entries.ts's
// toClientEntry flattens it into a ClientEntry.
export interface EntryRow {
  id: string;
  section_id: string;
  trip_id: string;
  rank: number | null;
  status: EntryStatus;
  archive_reason: string | null;
  notes: string | null;
  concerns: string | null;
  title: string | null;
  url: string | null;
  poster_image: string | null;
  description: string | null;
  lat: number | null;
  lng: number | null;
  /** Place region — reverse-geocoded from lat/lng (US state or country),
   * falling back to the trip's country. Hidden from the UI; used by
   * Categories / Future Interest filters. */
  country: string | null;
  extra_markers: MapReferencePoint[] | null;
  group_label: string | null;
  visited: boolean;
  visited_date: string | null;
  data: Record<string, unknown>;
  /** Set once this entry was created by syncing from another one (see
   * lib/entrySync.ts) — its own shared fields (title/url/posterImage/
   * description/lat/lng/data) mirror that source entry's and can't be
   * edited directly here; notes/concerns/visited/status stay local
   * either way. Null for a source itself, or a plain, never-imported
   * entry. */
  import_source_entry_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface ApiKey {
  id: string;
  trip_id: string | null;
  label: string;
  role: "owner" | "contributor";
  revoked: boolean;
  created_at: string;
  last_used_at: string | null;
  hasStoredToken?: boolean;
}

// A permanent-login editor on one trip (see supabase/migrations/
// 0021_trip_editors.sql) — user_id/email identify who, the rest is
// when they joined/last wrote here. No `revoked` flag: unlike an
// api_keys row, membership here is either present or it isn't (see the
// editors API routes, which just delete the row outright).
export interface TripEditor {
  user_id: string;
  email: string;
  created_at: string;
  last_active_at: string;
}

export interface AppSettings {
  id: true;
  google_drive_folder_id: string | null;
  site_url: string | null;
  contact_email: string | null;
}

export interface PlaceResult {
  id: string;
  title: string;
  address: string;
  summary: string | null;
  category: string | null;
  lat: number | null;
  lng: number | null;
  website: string | null;
  mapsUrl: string | null;
  photoUrl: string | null;
}

// One row of AddEntryForm's live "already on another trip?" dropdown —
// see lib/entries.ts's searchEntriesByTitle and the entries/search route.
export interface TitleMatch {
  id: string;
  title: string;
  description: string | null;
  posterImage: string | null;
  lat: number | null;
  lng: number | null;
  url: string | null;
  tripName: string;
  sectionLabel: string;
}

// See supabase/migrations/0023_itinerary_stops.sql.
export type ItineraryStopKind = "lodging" | "activity" | "meal" | "bar" | "transport" | "other";
export type ItineraryStopStatus = "tentative" | "confirmed" | "archived";
export type TravelMode = "driving" | "walking" | "transit" | "bicycling";
// An itinerary stop's own travel_mode is a superset of the real Google
// Directions modes above — "car_service" (Uber/taxi/car service) is
// presentation-only, not a 5th mode Google understands: a car service
// drives the same roads a regular car would, so wherever a leg's drive
// time actually gets computed, this maps down to "driving" first (see
// components/Itinerary/lib/itineraryTravelMode.ts). Kept as its own
// type rather than folded into TravelMode itself so nothing outside
// the itinerary (route_cache, the general /directions route, listing-
// card driving times) ever has to think about a mode Google doesn't
// support.
export type ItineraryTravelMode = TravelMode | "car_service";

export interface ItineraryStopRow {
  id: string;
  trip_id: string;
  entry_id: string | null;
  title: string | null;
  url: string | null;
  lat: number | null;
  lng: number | null;
  kind: ItineraryStopKind;
  status: ItineraryStopStatus;
  date: string | null;
  time: string | null;
  duration_minutes: number | null;
  travel_mode: ItineraryTravelMode;
  notes: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

// The client-facing shape — title/url/lat/lng resolved to the linked
// entry's own values when entry_id is set (see lib/itineraryStops.ts's
// toClientStop), plus enough of that entry's location in the site's
// own nav to link back to it (built the same #listing-<id> anchor way
// lib/sheetsExport.ts's buildRow already does).
export interface ItineraryStop extends ItineraryStopRow {
  entryNavGroupSlug: string | null;
  entrySectionSlug: string | null;
}

// One entry, as offered by the itinerary's "link an existing entry"
// picker — scoped to just this trip (unlike lib/entries.ts's cross-trip
// searchEntriesByTitle, linking a stop to some other trip's entry
// wouldn't make sense). sectionId lets the picker group these into a
// "type" dropdown (which section) before "which one" within it.
export interface ItineraryEntryOption {
  id: string;
  title: string | null;
  url: string | null;
  lat: number | null;
  lng: number | null;
  sectionId: string;
  sectionLabel: string;
  navGroupLabel: string;
}
