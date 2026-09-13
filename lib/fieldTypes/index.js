// Small registry mapping a field_defs.field_type to its behavior. New
// types register once here; EntryCard, AddEntryForm, and the Sheets
// exporter all consume this registry instead of switching on type
// inline, so adding a new built-in type never means hunting through
// every component that renders a field.
import * as price from "./price";
import * as count from "./count";
import * as textarea from "./textarea";

// Every type at minimum needs nothing beyond a plain value round-trip
// (render the stored value, store whatever's typed in) — text/url/
// image_url/number/select/boolean/date all just need their input control
// (that's a component-layer concern, not logic) and have no entry here.
export const FIELD_TYPES = {
  text: {},
  textarea,
  url: {},
  image_url: {},
  number: {},
  price,
  count,
  select: {},
  boolean: {},
  date: {},
};

export function getFieldType(type) {
  return FIELD_TYPES[type] || FIELD_TYPES.text;
}
