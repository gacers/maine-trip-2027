// "price" field type: a free-text price (e.g. "$450/night", "$3,150 for
// 7 nights"). Ports lib/priceUtils.js's exact parsing logic, generalized
// so it isn't tied to one hardcoded "price" column — any field typed
// "price" on any section gets this behavior for free.

const PER_NIGHT_RE = /\$\s?([\d,]+(?:\.\d+)?)\s*(?:\/\s?night|per\s?night)/gi;
const TOTAL_FOR_NIGHTS_RE = /\$\s?([\d,]+(?:\.\d+)?)\s*(?:total\s*)?for\s*(\d+)\s*nights?/i;
const PLAIN_NUMBER_RE = /^[\d,]+(?:\.\d+)?$/;

// True when the text already says how it breaks down on its own
// ("/night", or "for N nights") — nothing else is needed to interpret
// it. A lone "$3,500"-style figure (or a bare number, no "$" at all)
// doesn't say either way, and — confirmed live, this used to guess
// based on whatever the trip's own length happened to be, which
// actively produced a *wrong* reading the moment that guess was wrong
// (a real $273/night price, with the trip's real 7-night length known,
// got divided down to "~$30/night") — is deliberately never guessed at
// automatically anymore. FieldInput's own per-night/total-for-stay
// toggle (see PriceFieldInput) is the only thing that resolves a bare
// number now, by asking directly instead of assuming, and bakes the
// answer into the stored text itself (e.g. "$273/night" or "$1,911 for
// 7 nights") so it's unambiguous and self-describing from then on.
export function hasStatedRate(priceText: string | null | undefined): boolean {
  if (!priceText) return false;
  const text = String(priceText);
  return PER_NIGHT_RE.test(text) || TOTAL_FOR_NIGHTS_RE.test(text);
}

export function extractAvgPerNight(priceText: string | null | undefined): number | null {
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
export function computeBadge(rawValue: string | null | undefined): string | null {
  if (!rawValue) return null;
  const avg = extractAvgPerNight(rawValue);
  if (avg == null) return null;
  if (/\/\s?night|per\s?night/i.test(String(rawValue))) return null;
  return formatAvgPerNight(avg);
}

// A price typed (or scraped) as a bare number with no "$" and nothing
// else ("500", "3,500.50") still deserves to look like real money, not
// a stray unlabeled number — reformats it as currency for display.
// Anything that already has a "$", or any other text at all (a stated
// rate, "for 7 nights", ...), is left exactly as typed/stored.
export function formatPriceDisplay(rawValue: string | null | undefined): string {
  if (!rawValue) return "";
  const trimmed = rawValue.trim();
  if (!PLAIN_NUMBER_RE.test(trimmed)) return rawValue;
  const amount = Number(trimmed.replace(/,/g, ""));
  if (Number.isNaN(amount)) return rawValue;
  return `$${amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

export interface TripLengthSource {
  start_date?: string | null;
  end_date?: string | null;
  nights_estimate?: number | null;
}

// A trip's length in nights — from a real start/end date range if both
// are set (more precise, and self-correcting if either date changes
// later), otherwise nights_estimate (see Trip.nights_estimate, for
// before exact dates are locked in). Used by PriceFieldInput's "total
// for stay" mode to bake a real "for N nights" into what gets stored,
// at the moment of entry — not guessed later from whatever the trip's
// length happens to be by then.
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
export function exportValue(rawValue: string | null | undefined): string {
  const avg = extractAvgPerNight(rawValue);
  return avg == null ? "" : `$${Math.round(avg).toLocaleString()}`;
}
