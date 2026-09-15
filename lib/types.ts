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
  supports_ranking: boolean;
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
  /** Fallback trip length when there's no real start_date+end_date
   * range yet — lets a price field's own lone total (no stated "/
   * night" or "for N nights") still resolve to a useful avg/night
   * instead of being ambiguous (see lib/fieldTypes/price.ts). */
  nights_estimate?: number | null;
  /** The trips-index card's own full-bleed background photo (see
   * TripSettingsForm) — a plain pasted URL, not derived from any
   * entry's own photo. */
  cover_image?: string | null;
  /** Set once the trip has actually happened and been reviewed — drives
   * the trips index's Pending/Past split (past = completed OR its own
   * dates have already passed, see app/page.tsx) and gates the
   * "Archive unvisited" nav action (see ArchiveUnvisitedButton). */
  completed: boolean;
  map_config: MapConfig;
  google_sheet_id?: string | null;
  google_sheet_url?: string | null;
  archived: boolean;
  // Admin-only secrets — present on the raw row, stripped by
  // sanitizeTripForClient before reaching a Client Component or a
  // public API response.
  sheet_invite_token?: string | null;
  sheet_invite_key_id?: string | null;
}

// A trip row as it reaches a Client Component/public response — see
// lib/sections.ts's sanitizeTripForClient.
export type PublicTrip = Omit<Trip, "sheet_invite_token" | "sheet_invite_key_id" | "google_sheet_url" | "google_sheet_id">;

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
  extra_markers: MapReferencePoint[] | null;
  group_label: string | null;
  visited: boolean;
  visited_date: string | null;
  data: Record<string, unknown>;
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
