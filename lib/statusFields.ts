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

export function parseCoord(value: unknown): number | null {
  if (value === "" || value == null) return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

export function hasMovedFrom(data: Record<string, unknown>): boolean {
  return parseCoord(data[MOVED_FROM_LAT_KEY]) != null && parseCoord(data[MOVED_FROM_LNG_KEY]) != null;
}

export function oldLocationMapsUrl(fromLat: unknown, fromLng: unknown): string | null {
  const lat = parseCoord(fromLat);
  const lng = parseCoord(fromLng);
  if (lat == null || lng == null) return null;
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
}

/** Stash prior coords once — never overwrite an existing old pin. */
export function stashMovedFrom(
  data: Record<string, unknown>,
  fromLat: unknown,
  fromLng: unknown
): Record<string, unknown> {
  if (hasMovedFrom(data)) return data;
  const nextLat = parseCoord(fromLat);
  const nextLng = parseCoord(fromLng);
  if (nextLat == null || nextLng == null) return data;
  return {
    ...data,
    [MOVED_FROM_LAT_KEY]: nextLat,
    [MOVED_FROM_LNG_KEY]: nextLng,
  };
}

/** When Moved is on, stash current coords as the old pin the first time. */
export function withMovedFromStash(
  data: Record<string, unknown>,
  lat: unknown,
  lng: unknown
): Record<string, unknown> {
  if (!isTruthyFlag(data.moved)) return data;
  return stashMovedFrom(data, lat, lng);
}

/**
 * Find / save helper: if this listing already had a pin and we're
 * writing a new one under Moved, keep the prior pin for Old Address.
 * Using the address Find field with an existing pin also turns Moved on.
 */
export function applyMovedLocationChange(args: {
  data: Record<string, unknown>;
  /** Coords before this edit (entry pin when edit started). */
  priorLat: unknown;
  priorLng: unknown;
  /** Coords after Find / manual edit. */
  nextLat: unknown;
  nextLng: unknown;
  /** True when the user used the "new location when Moved" Find field. */
  fromAddressFind?: boolean;
}): Record<string, unknown> {
  const { data, priorLat, priorLng, nextLat, nextLng, fromAddressFind } = args;
  const prior = { lat: parseCoord(priorLat), lng: parseCoord(priorLng) };
  const next = { lat: parseCoord(nextLat), lng: parseCoord(nextLng) };
  const hadPrior = prior.lat != null && prior.lng != null;
  const hasNext = next.lat != null && next.lng != null;
  const changed =
    hadPrior &&
    hasNext &&
    (Math.abs(prior.lat! - next.lat!) > 1e-7 || Math.abs(prior.lng! - next.lng!) > 1e-7);

  let out = { ...data };
  if (fromAddressFind && hadPrior && changed) {
    out.moved = true;
  }
  // Only stash when the pin actually moves (or Find ran), so checking
  // Moved alone doesn't invent an "Old Address" that matches the current map.
  if (isTruthyFlag(out.moved) && hadPrior && (changed || !!fromAddressFind || hasMovedFrom(out))) {
    out = stashMovedFrom(out, prior.lat, prior.lng);
  }
  return out;
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

/** Flatten a PATCH `data` bag onto ClientEntry's top-level shape. */
export function flattenEntryDataPatch<T extends Record<string, unknown>>(
  entry: T,
  patch: Record<string, unknown>
): T {
  const { data, ...rest } = patch;
  if (data && typeof data === "object" && !Array.isArray(data)) {
    return { ...entry, ...rest, ...(data as Record<string, unknown>) } as T;
  }
  return { ...entry, ...patch } as T;
}
