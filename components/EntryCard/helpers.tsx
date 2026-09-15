import { Bath, BedDouble, BedSingle, Hash } from "lucide-react";
import styles from "./helpers.module.css";

// A raw street address ("9 Thurston Rd, Bernard, ME 04612, USA") ending
// up as the whole description — the Google Places fallback used to do
// exactly this whenever a place had no editorial summary (see
// AddEntryForm's choosePlace) — isn't real descriptive content; the
// address is already covered by the address line below the title, so a
// line that's just that reads as a broken/duplicated field, not a
// description. Filtered out here (rather than at save time) so it also
// catches entries added before that fallback was fixed.
const US_ADDRESS_RE = /,\s*[A-Z]{2}\s*\d{5}(-\d{4})?(,\s*(USA|United States))?\s*$/;
export function isAddressLike(line: string): boolean {
  return US_ADDRESS_RE.test(line.trim());
}

export const MARKER_COLORS = ["#1A73E8", "#EF6C00", "#00897B", "#C2185B", "#5D4037", "#616161"];

// A count field's label is stored plural ("Bedrooms", "Beds",
// "Bathrooms") since that's how it reads in the field-defs admin UI and
// in the count summary for the common >1 case — singularized here only
// for display when the actual value is exactly 1 ("1 Bedroom", not
// "1 Bedrooms"). Simple heuristic covers every count field in use today;
// good enough for whatever an admin invents later too.
export function singularizeCountLabel(label: string, value: unknown): string {
  if (Number(value) !== 1) return label;
  if (/ies$/i.test(label)) return label.replace(/ies$/i, "y");
  if (/s$/i.test(label)) return label.replace(/s$/i, "");
  return label;
}

// Picks a purpose-built icon by matching words in the field's own label —
// generic count fields with an unrecognized label (anything an admin
// might invent later) still get a sensible fallback rather than nothing.
export function countFieldIcon(label: string) {
  const l = label.toLowerCase();
  if (l.includes("bath")) return <Bath size={17} className={styles["count-icon"]} />;
  if (l.includes("bedroom")) return <BedDouble size={17} className={styles["count-icon"]} />;
  if (l.includes("bed")) return <BedSingle size={17} className={styles["count-icon"]} />;
  return <Hash size={17} className={styles["count-icon"]} />;
}
