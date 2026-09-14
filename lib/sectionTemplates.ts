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
    navGroupLabel: "Houses",
    fieldDefs: HOUSE_FIELD_DEFS,
    possible: {
      slug: "possible-houses",
      label: "Possible Houses",
      addPlaceholder: "Paste an Airbnb, VRBO, or other listing URL...",
      emptyMessage: "No listings yet — paste a URL above.",
    },
    previous: {
      slug: "previous-houses",
      label: "Previous Houses",
      addPlaceholder: "Paste a link for a place you've stayed before...",
      emptyMessage: "No past stays yet — paste a link above.",
    },
  },
  {
    key: "foodDrink",
    navGroupLabel: "Food & Drink",
    fieldDefs: [],
    possible: {
      slug: "possible-food-drink",
      label: "Possible Food & Drink",
      addPlaceholder: "Paste a link for a bar or restaurant you want to try...",
      emptyMessage: "No spots yet — paste a link above.",
    },
    previous: {
      slug: "previous-food-drink",
      label: "Previous Food & Drink",
      addPlaceholder: "Paste a link for a bar or restaurant you've already been to...",
      emptyMessage: "No visited spots yet — paste a link above.",
    },
  },
  {
    key: "activities",
    navGroupLabel: "Activities",
    fieldDefs: [],
    possible: {
      slug: "possible-activities",
      label: "Possible Activities",
      addPlaceholder: "Paste a link for a hike, tour, or activity...",
      emptyMessage: "No activities yet — paste a link above.",
    },
    previous: {
      slug: "previous-activities",
      label: "Previous Activities",
      addPlaceholder: "Paste a link for a hike, tour, or activity you've already done...",
      emptyMessage: "No previous activities yet — paste a link above.",
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
for (const template of SECTION_TEMPLATES) {
  if (template.key === "foodDrink" || template.key === "activities") {
    template.fieldDefs = [...template.fieldDefs, CLOSED_FIELD_DEF];
  }
}

// Extra Food & Drink type tags, alongside whatever an admin already
// added by hand via the Section Designer (e.g. Restaurant/Bar/Cafe) —
// same generic boolean-field-as-filter/eyebrow mechanism as Closed
// above, just specific to places that make their own alcohol.
const FOOD_DRINK_TYPE_FIELD_DEFS: TemplateFieldDef[] = [
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
