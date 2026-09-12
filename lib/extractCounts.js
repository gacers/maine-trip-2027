// Best-effort extraction of bedroom/bed/bathroom counts from a
// description's free text (the doc-style bullets we write when adding a
// listing), so the Overview sheet gets a structured column instead of
// requiring someone to reread the bullets.
//
// `\bbeds?\b` deliberately won't match inside "bedroom(s)" — after "bed"
// in "bedroom" comes "r", not a word boundary, so the two patterns don't
// collide even though "bed" is a substring of "bedroom".
export function extractCounts(description) {
  const text = description || "";

  const bedroomsMatch = text.match(/(\d+)\s*bedrooms?\b/i);
  const bedsMatch = text.match(/(\d+)\s*beds?\b/i);
  const bathroomsMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:bathrooms?|baths?)\b/i);

  return {
    bedrooms: bedroomsMatch ? Number(bedroomsMatch[1]) : "",
    beds: bedsMatch ? Number(bedsMatch[1]) : "",
    bathrooms: bathroomsMatch ? Number(bathroomsMatch[1]) : "",
  };
}

// Formats bedrooms/beds/bathrooms into one short human string, e.g.
// "3 BR / 6 beds / 3 BA". Omits any part that's missing. Returns "" if
// nothing is set.
export function formatBedBath(item) {
  const parts = [];
  if (item.bedrooms !== "" && item.bedrooms !== null && item.bedrooms !== undefined) {
    parts.push(`${item.bedrooms} BR`);
  }
  if (item.beds !== "" && item.beds !== null && item.beds !== undefined) {
    parts.push(`${item.beds} bed${Number(item.beds) === 1 ? "" : "s"}`);
  }
  if (item.bathrooms !== "" && item.bathrooms !== null && item.bathrooms !== undefined) {
    parts.push(`${item.bathrooms} BA`);
  }
  return parts.join(" / ");
}
