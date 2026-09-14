// "textarea" field type: free-form multi-line text, rendered as a
// bullet list on read — same as ListingCard.jsx's toBullets() today,
// generalized to any textarea-type field, not just description.
export function toBullets(text: string | null | undefined): string[] {
  return (text || "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}
