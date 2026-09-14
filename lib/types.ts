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
  options?: { choices?: string[]; aliases?: string[] } | null;
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
  compact_cards: boolean;
  enabled: boolean;
  sort_order: number;
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
  averageScore?: number | null;
  ratingCount?: number;
  myScore?: number | null;
  // Section-specific field_def values (price, bedrooms, Closed, ...),
  // keyed by each field's own `key` — genuinely dynamic per section.
  [fieldKey: string]: unknown;
}
