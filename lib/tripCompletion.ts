import type { Section } from "@/lib/types";

// The trait shared by every "still deciding among options" section
// (Possible Houses, Stay Options, ...) regardless of what it's named —
// ranking, ratings, or pairing only make sense when there's a real
// choice being weighed. A section with none of these on is a plain
// log/list: whatever gets added to it just happened, nothing about it
// was a rejected candidate.
export function sectionHasOptionsTraits(section: Pick<Section, "supports_ranking" | "supports_ratings" | "supports_pairing">): boolean {
  return !!(section.supports_ranking || section.supports_ratings || section.supports_pairing);
}
