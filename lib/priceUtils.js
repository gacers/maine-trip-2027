// Best-effort average-per-night calculation from a listing's free-text
// price field (e.g. "$5,467 for 7 nights", "$781/night", or a price
// someone already annotated with "(~$781/night)" themselves).

// Matches an explicit "$X/night" or "$X per night" anywhere in the text —
// the most authoritative source when present, since it's already a
// nightly rate rather than something we have to derive. If more than one
// match exists (e.g. someone appended "(~$781/night)" after a total),
// the last one wins, since that's the one meant to clarify the total.
const PER_NIGHT_RE = /\$\s?([\d,]+(?:\.\d+)?)\s*(?:\/\s?night|per\s?night)/gi;

// Matches "$X for N nights" (optionally "$X total for N nights") — a
// total price we can average out ourselves.
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
