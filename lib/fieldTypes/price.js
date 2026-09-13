// "price" field type: a free-text price (e.g. "$450/night", "$3,150 for
// 7 nights"). Ports lib/priceUtils.js's exact parsing logic, generalized
// so it isn't tied to one hardcoded "price" column — any field typed
// "price" on any section gets this behavior for free.

const PER_NIGHT_RE = /\$\s?([\d,]+(?:\.\d+)?)\s*(?:\/\s?night|per\s?night)/gi;
const TOTAL_FOR_NIGHTS_RE = /\$\s?([\d,]+(?:\.\d+)?)\s*(?:total\s*)?for\s*(\d+)\s*nights?/i;

export function extractAvgPerNight(priceText) {
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
export function formatAvgPerNight(amount) {
  if (amount == null || Number.isNaN(amount)) return "";
  return `~$${Math.round(amount).toLocaleString()}/night`;
}

// What EntryCard shows next to the raw price value. Only computed when
// the raw text doesn't already spell out a nightly rate itself (avoids
// showing the same number twice) — same rule ListingCard.jsx used.
export function computeBadge(rawValue) {
  if (!rawValue) return null;
  const avg = extractAvgPerNight(rawValue);
  if (avg == null) return null;
  if (/\/\s?night|per\s?night/i.test(String(rawValue))) return null;
  return formatAvgPerNight(avg);
}

// Sheets-export value: bakes "$" into text rather than relying on a
// cell-level currency numberFormat. A 2+ item grouped row's cell is a
// "\n"-joined multi-line string, which Sheets stores as text — a
// numberFormat silently never applies to it (found and fixed this
// session). Baking "$" into the value itself works the same either way.
export function exportValue(rawValue) {
  const avg = extractAvgPerNight(rawValue);
  return avg == null ? "" : `$${Math.round(avg).toLocaleString()}`;
}
