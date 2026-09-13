// "count" field type: a number, auto-extractable from a sibling
// description-style field (e.g. "3 bedrooms, 2 baths" -> a field labeled
// "Bedrooms" reads 3) when not typed in directly. Generalizes
// lib/extractCounts.js off each field's own label/aliases instead of
// hardcoded bedroom/bed/bathroom names — e.g. a "Bathrooms" count field
// can set options.aliases: ["bath","baths"] to also match "2 baths",
// matching today's exact bedrooms/beds/bathrooms behavior when a
// section's fields are configured that way.

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function wordsToMatch(fieldDef) {
  const base = (fieldDef.label || fieldDef.key || "").trim().toLowerCase();
  const singular = base.endsWith("s") ? base.slice(0, -1) : base;
  const aliases = fieldDef.options?.aliases || [];
  return [singular, ...aliases].filter(Boolean);
}

// extractCount("3 bedrooms, 2 baths", {label: "Bedrooms"}) -> 3
export function extractCount(text, fieldDef) {
  if (!text) return "";
  for (const word of wordsToMatch(fieldDef)) {
    const re = new RegExp(`\\b(\\d+(?:\\.\\d+)?)\\s*${escapeRegExp(word)}s?\\b`, "i");
    const m = String(text).match(re);
    if (m) return Number(m[1]);
  }
  return "";
}

// Joins every count-type field's current value into one summary line,
// e.g. "3 Bedrooms / 6 Beds / 2 Bathrooms". A field's
// `options.shortLabel` (e.g. "BR") overrides the plain label, to match
// today's compact "3 BR / 6 beds / 2 BA" card style when wanted.
export function formatCounts(fieldsWithValues) {
  return fieldsWithValues
    .filter(({ value }) => value !== "" && value !== null && value !== undefined)
    .map(({ fieldDef, value }) => `${value} ${fieldDef.options?.shortLabel || fieldDef.label}`)
    .join(" / ");
}
