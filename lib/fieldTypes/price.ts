// "price" field type: a free-text price (e.g. "$450/night", "$3,150 for
// 7 nights"). Ports lib/priceUtils.js's exact parsing logic, generalized
// so it isn't tied to one hardcoded "price" column — any field typed
// "price" on any section gets this behavior for free.

const PER_NIGHT_RE = /\$\s?([\d,]+(?:\.\d+)?)\s*(?:\/\s?night|per\s?night)/gi;
const TOTAL_FOR_NIGHTS_RE = /\$\s?([\d,]+(?:\.\d+)?)\s*(?:total\s*)?for\s*(\d+)\s*nights?/i;
const BARE_AMOUNT_RE = /\$\s?([\d,]+(?:\.\d+)?)/;

// True when the text already says how it breaks down on its own
// ("/night", or "for N nights") — nothing about the trip's own length
// is needed to interpret it. False for a lone "$3,500"-style figure,
// which is ambiguous without outside help (see fallbackNights below).
export function hasStatedRate(priceText: string | null | undefined): boolean {
  if (!priceText) return false;
  const text = String(priceText);
  return PER_NIGHT_RE.test(text) || TOTAL_FOR_NIGHTS_RE.test(text);
}

// `fallbackNights` — a trip's real date-range length, or its
// nights_estimate when there's no real range yet (see
// Trip.nights_estimate and SectionPage/sheetsExport's computeTripNights)
// — resolves a lone total ("$3,500", no stated breakdown) into an avg/
// night the same way an explicit "for N nights" would, instead of
// giving up on it entirely. Without either, a lone figure is left
// unresolved here — see computeBadge/EntryCard for how that case
// displays instead (treated as already being the per-night rate).
export function extractAvgPerNight(priceText: string | null | undefined, fallbackNights?: number | null): number | null {
  if (!priceText) return null;
  const text = String(priceText);

  const perNightMatches = [...text.matchAll(PER_NIGHT_RE)];
  if (perNightMatches.length > 0) {
    const amount = Number(perNightMatches[perNightMatches.length - 1][1].replace(/,/g, ""));
    return Number.isNaN(amount) ? null : amount;
  }

  const totalMatch = text.match(TOTAL_FOR_NIGHTS_RE);
  if (totalMatch) {
    const total = Number(totalMatch[1].replace(/,/g, ""));
    const nights = Number(totalMatch[2]);
    if (!Number.isNaN(total) && nights > 0) return total / nights;
  }

  if (fallbackNights && fallbackNights > 0) {
    const bare = text.match(BARE_AMOUNT_RE);
    if (bare) {
      const total = Number(bare[1].replace(/,/g, ""));
      if (!Number.isNaN(total)) return total / fallbackNights;
    }
  }

  return null;
}

// e.g. 780.5 -> "~$781/night"
export function formatAvgPerNight(amount: number | null | undefined): string {
  if (amount == null || Number.isNaN(amount)) return "";
  return `~$${Math.round(amount).toLocaleString()}/night`;
}

// What EntryCard shows next to the raw price value. Only computed when
// the raw text doesn't already spell out a nightly rate itself (avoids
// showing the same number twice) — same rule ListingCard.jsx used.
export function computeBadge(rawValue: string | null | undefined, fallbackNights?: number | null): string | null {
  if (!rawValue) return null;
  const avg = extractAvgPerNight(rawValue, fallbackNights);
  if (avg == null) return null;
  if (/\/\s?night|per\s?night/i.test(String(rawValue))) return null;
  return formatAvgPerNight(avg);
}

// A lone "$3,500"-style figure with no stated rate and no trip length
// (real or estimated) to assume one from is genuinely ambiguous — but
// treating it as an unexplained "total" of unknown duration is worse
// than the alternative: read it as already being the per-night rate.
// EntryCard uses this to decide whether to display the raw value as
// the headline *total* (the normal case) or reformat/label it as the
// per-night rate instead.
export function isAmbiguousBareAmount(rawValue: string | null | undefined, fallbackNights?: number | null): boolean {
  if (!rawValue) return false;
  const text = String(rawValue);
  if (hasStatedRate(text)) return false;
  if (fallbackNights && fallbackNights > 0) return false;
  return BARE_AMOUNT_RE.test(text);
}

// Reformats a bare "$3,500" into "$3,500/night" for display once
// isAmbiguousBareAmount says that's the right read of it — no math
// here (unlike formatAvgPerNight's computed "~"), the number itself
// doesn't change, only its label.
export function formatBareAsPerNight(rawValue: string): string {
  return /\/\s?night|per\s?night/i.test(rawValue) ? rawValue : `${rawValue.trim()}/night`;
}

export interface TripLengthSource {
  start_date?: string | null;
  end_date?: string | null;
  nights_estimate?: number | null;
}

// A trip's length in nights — from a real start/end date range if both
// are set (more precise, and self-correcting if either date changes
// later), otherwise nights_estimate (see Trip.nights_estimate, for
// before exact dates are locked in). Null if neither is available,
// which is exactly when a price field's own bare, unexplained total
// gets treated as a per-night rate instead (see isAmbiguousBareAmount).
export function computeTripNights(trip: TripLengthSource): number | null {
  if (trip.start_date && trip.end_date) {
    const start = new Date(trip.start_date);
    const end = new Date(trip.end_date);
    const nights = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    if (nights > 0) return nights;
  }
  return trip.nights_estimate ?? null;
}

// Sheets-export value: bakes "$" into text rather than relying on a
// cell-level currency numberFormat. A 2+ item grouped row's cell is a
// "\n"-joined multi-line string, which Sheets stores as text and
// silently ignores numberFormat on (found and fixed for the old
// single-sheet Overview this session — same fix applies here).
export function exportValue(rawValue: string | null | undefined, fallbackNights?: number | null): string {
  const avg = extractAvgPerNight(rawValue, fallbackNights);
  return avg == null ? "" : `$${Math.round(avg).toLocaleString()}`;
}
