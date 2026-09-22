import type { FieldType } from "@/lib/types";

// Starter section templates offered when setting up a trip — the same
// "possible / previous" pair shape every one of Maine 2027's built-in
// categories uses. Picking one creates both sections in one new nav
// group (same two-call flow as the Section Designer's own "Previously
// Visited" counterpart button), fully editable/deletable afterward —
// this is just a fast starting point, not a locked-in structure.

// A template field def, before the section POST route fills in the rest
// (id, section_id, sort_order, storage, core_column, required).
export interface TemplateFieldDef {
  key: string;
  label: string;
  field_type: FieldType;
  show_on_overview: boolean;
  options?: { aliases?: string[] };
}

export interface SectionTemplateHalf {
  slug: string;
  label: string;
  addPlaceholder: string;
  emptyMessage: string;
}

export interface SectionTemplate {
  key: string;
  navGroupLabel: string;
  fieldDefs: TemplateFieldDef[];
  possible: SectionTemplateHalf;
  previous: SectionTemplateHalf;
}

const HOUSE_FIELD_DEFS: TemplateFieldDef[] = [
  { key: "price", label: "Price", field_type: "price", show_on_overview: true },
  { key: "bedrooms", label: "Bedrooms", field_type: "count", show_on_overview: true },
  { key: "beds", label: "Beds", field_type: "count", show_on_overview: true },
  {
    key: "bathrooms",
    label: "Bathrooms",
    field_type: "count",
    show_on_overview: true,
    options: { aliases: ["bath", "baths"] },
  },
];

export const SECTION_TEMPLATES: SectionTemplate[] = [
  {
    key: "houses",
    navGroupLabel: "Stays",
    fieldDefs: HOUSE_FIELD_DEFS,
    possible: {
      slug: "options",
      label: "Stay Options",
      addPlaceholder: "Paste an Airbnb, VRBO, or other listing URL...",
      emptyMessage: "No listings yet",
    },
    previous: {
      slug: "previously-visited",
      label: "Stayed Before",
      addPlaceholder: "Paste a link for a place you've stayed before...",
      emptyMessage: "No past stays yet",
    },
  },
  {
    key: "foodDrink",
    navGroupLabel: "Food & Drink",
    fieldDefs: [],
    possible: {
      slug: "options",
      label: "Food & Drink Options",
      addPlaceholder: "Paste a link for a bar or restaurant you want to try...",
      emptyMessage: "No spots yet",
    },
    previous: {
      slug: "previously-visited",
      label: "Past Food & Drink",
      addPlaceholder: "Paste a link for a bar or restaurant you've already been to...",
      emptyMessage: "No visited spots yet",
    },
  },
  {
    key: "activities",
    navGroupLabel: "Activities",
    fieldDefs: [],
    possible: {
      slug: "options",
      label: "Activity Options",
      addPlaceholder: "Paste a link for a hike, tour, or activity...",
      emptyMessage: "No activities yet",
    },
    previous: {
      slug: "previously-visited",
      label: "Past Activities",
      addPlaceholder: "Paste a link for a hike, tour, or activity you've already done...",
      emptyMessage: "No previous activities yet",
    },
  },
];

// A place can close down between when it's added and when you'd
// actually go — worth flagging on Food & Drink and Activities (not
// Houses, which doesn't have the same "wait, is this even open still"
// concern). Shows as a small badge on the entry and, since
// show_on_overview is set, in the Sheet too.
const CLOSED_FIELD_DEF: TemplateFieldDef = {
  key: "closed",
  label: "Closed",
  field_type: "boolean",
  show_on_overview: true,
};
// Same surfaces as Closed — business relocated; card map shows the new
// pin, with an Old Location Map link back to the previous coords.
const MOVED_FIELD_DEF: TemplateFieldDef = {
  key: "moved",
  label: "Moved",
  field_type: "boolean",
  show_on_overview: true,
};
const MOVED_ADDRESS_FIELD_DEF: TemplateFieldDef = {
  key: "moved_address",
  label: "New address",
  field_type: "text",
  show_on_overview: true,
};
for (const template of SECTION_TEMPLATES) {
  // Closed / Moved are site-wide status — every starter section gets them.
  template.fieldDefs = [...template.fieldDefs, CLOSED_FIELD_DEF, MOVED_FIELD_DEF, MOVED_ADDRESS_FIELD_DEF];
}

// Food & Drink's own type tags — same generic boolean-field-as-filter/
// eyebrow mechanism as Closed above. Matches every type tag Maine 2027
// actually ended up using (added by hand over time, one at a time, as
// real listings needed them) except Seafood Shack and Oyster Farm —
// specific enough to a coastal Maine trip that they don't belong in
// every new trip's starting point; add them by hand via the Section
// Designer if a trip actually needs them.
export const FOOD_DRINK_TYPE_FIELD_DEFS: TemplateFieldDef[] = [
  { key: "restaurant", label: "Restaurant", field_type: "boolean", show_on_overview: true },
  { key: "bar", label: "Bar", field_type: "boolean", show_on_overview: true },
  { key: "cafe", label: "Cafe", field_type: "boolean", show_on_overview: true },
  { key: "breakfast", label: "Breakfast", field_type: "boolean", show_on_overview: true },
  { key: "lunch", label: "Lunch", field_type: "boolean", show_on_overview: true },
  { key: "dinner", label: "Dinner", field_type: "boolean", show_on_overview: true },
  { key: "winery", label: "Winery", field_type: "boolean", show_on_overview: true },
  { key: "distillery", label: "Distillery", field_type: "boolean", show_on_overview: true },
  { key: "brewery", label: "Brewery", field_type: "boolean", show_on_overview: true },
  { key: "market", label: "Market", field_type: "boolean", show_on_overview: true },
];
for (const template of SECTION_TEMPLATES) {
  if (template.key === "foodDrink") {
    template.fieldDefs = [...template.fieldDefs, ...FOOD_DRINK_TYPE_FIELD_DEFS];
  }
}

// Same idea, for Activities' own type tags.
export const ACTIVITIES_TYPE_FIELD_DEFS: TemplateFieldDef[] = [
  { key: "hike", label: "Hike", field_type: "boolean", show_on_overview: true },
  { key: "kayak", label: "Kayak", field_type: "boolean", show_on_overview: true },
  { key: "boatTour", label: "Boat Tour", field_type: "boolean", show_on_overview: true },
  { key: "sightSeeing", label: "Sight Seeing", field_type: "boolean", show_on_overview: true },
  { key: "beach", label: "Beach", field_type: "boolean", show_on_overview: true },
  { key: "island", label: "Island", field_type: "boolean", show_on_overview: true },
];
for (const template of SECTION_TEMPLATES) {
  if (template.key === "activities") {
    template.fieldDefs = [...template.fieldDefs, ...ACTIVITIES_TYPE_FIELD_DEFS];
  }
}

/** Closed / Moved / New address — shared across every section kind. */
export const STATUS_FIELD_DEFS: TemplateFieldDef[] = [
  CLOSED_FIELD_DEF,
  MOVED_FIELD_DEF,
  MOVED_ADDRESS_FIELD_DEF,
];

