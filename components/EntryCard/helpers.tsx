import { Bath, BedDouble, BedSingle, Hash, Phone, Mail, MapPin, Clock, Globe } from "lucide-react";
import type { FieldDef } from "@/lib/types";
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

// Same idea as countFieldIcon, for a generic "show on overview" field
// (anything not already handled by its own dedicated display — price/
// count/boolean, see EntryCard) — a phone number, a website, whatever
// an admin adds later. Unlike counts (always a number, so always worth
// *some* icon), an arbitrary text field with no recognizable label
// often has no sensible icon at all — this is a best-effort match, so
// it returns null rather than forcing a generic icon onto it.
export function overviewFieldIcon(fieldDef: FieldDef) {
  const l = `${fieldDef.key} ${fieldDef.label}`.toLowerCase();
  if (l.includes("phone") || l.includes("tel")) return <Phone size={15} className={styles["overview-icon"]} />;
  if (l.includes("email")) return <Mail size={15} className={styles["overview-icon"]} />;
  if (l.includes("address")) return <MapPin size={15} className={styles["overview-icon"]} />;
  if (l.includes("hour") || l.includes("time")) return <Clock size={15} className={styles["overview-icon"]} />;
  if (fieldDef.field_type === "url" || l.includes("website") || l.includes("site") || l.includes("link")) {
    return <Globe size={15} className={styles["overview-icon"]} />;
  }
  return null;
}
