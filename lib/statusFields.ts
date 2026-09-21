import type { FieldDef } from "@/lib/types";

/** Status booleans — reserved badge variants, not decorative type colors. */
export const STATUS_BOOLEAN_KEYS = ["closed", "moved"] as const;
export type StatusBooleanKey = (typeof STATUS_BOOLEAN_KEYS)[number];

export const MOVED_ADDRESS_KEY = "moved_address";
/** Prior pin, kept when Moved is checked so the card map can show the new spot. */
export const MOVED_FROM_LAT_KEY = "moved_from_lat";
export const MOVED_FROM_LNG_KEY = "moved_from_lng";

export function isStatusBooleanKey(key: string): key is StatusBooleanKey {
  return (STATUS_BOOLEAN_KEYS as readonly string[]).includes(key);
}

export function statusBadgeVariant(key: string): "closed" | "moved" | null {
  if (key === "closed") return "closed";
  if (key === "moved") return "moved";
  return null;
}

/** Closed first, then Moved, then the rest in fieldDefs order. */
export function orderBooleanBadgeFields<T extends { key: string }>(fields: T[]): T[] {
  const priority = (key: string) => (key === "closed" ? 0 : key === "moved" ? 1 : 2);
  return [...fields].sort((a, b) => {
    const diff = priority(a.key) - priority(b.key);
    if (diff !== 0) return diff;
    return 0;
  });
}

export function isTruthyFlag(value: unknown): boolean {
  return value === true || value === "true";
}

export function oldLocationMapsUrl(fromLat: unknown, fromLng: unknown): string | null {
  const lat = typeof fromLat === "number" ? fromLat : fromLat === "" || fromLat == null ? null : Number(fromLat);
  const lng = typeof fromLng === "number" ? fromLng : fromLng === "" || fromLng == null ? null : Number(fromLng);
  if (lat == null || lng == null || Number.isNaN(lat) || Number.isNaN(lng)) return null;
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
}

/** Stash current coords as the old pin the first time Moved turns on. */
export function withMovedFromStash(
  data: Record<string, unknown>,
  lat: unknown,
  lng: unknown
): Record<string, unknown> {
  if (!isTruthyFlag(data.moved)) return data;
  const hasFrom =
    data[MOVED_FROM_LAT_KEY] !== "" &&
    data[MOVED_FROM_LAT_KEY] != null &&
    data[MOVED_FROM_LNG_KEY] !== "" &&
    data[MOVED_FROM_LNG_KEY] != null;
  if (hasFrom) return data;
  const nextLat = lat === "" || lat == null ? null : Number(lat);
  const nextLng = lng === "" || lng == null ? null : Number(lng);
  if (nextLat == null || nextLng == null || Number.isNaN(nextLat) || Number.isNaN(nextLng)) return data;
  return {
    ...data,
    [MOVED_FROM_LAT_KEY]: nextLat,
    [MOVED_FROM_LNG_KEY]: nextLng,
  };
}

export function visibleFieldDefsForEdit(
  fieldDefs: FieldDef[],
  data: Record<string, unknown>
): FieldDef[] {
  const movedOn = isTruthyFlag(data.moved);
  return fieldDefs.filter((f) => {
    if (f.key === MOVED_ADDRESS_KEY) return movedOn;
    return true;
  });
}
