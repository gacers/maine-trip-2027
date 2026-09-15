import type { Section } from "@/lib/types";

// The trait shared by every "still deciding among options" section
// (Possible Houses, Stay Options, ...) regardless of what it's named —
// ratings or pairing only make sense when there's a real choice being
// weighed. A section with neither on is a plain log/list: whatever
// gets added to it just happened, nothing about it was a rejected
// candidate.
export function sectionHasOptionsTraits(section: Pick<Section, "supports_ratings" | "supports_pairing">): boolean {
  return !!(section.supports_ratings || section.supports_pairing);
}
