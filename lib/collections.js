// Config for every "collection" the site tracks. Each one gets its own
// hidden raw sheet tab + human-friendly Overview tab (same schema), its
// own API routes (via the [collection] dynamic segment), and its own
// page route — all driven by this one config object rather than
// duplicated per collection.
//
// Collections are further organized into top-level nav GROUPS (Houses /
// Food & Drink / Activities), each with two sub-tabs: a "possible/still
// deciding" collection and a "already happened" one. `navLabel` on a
// group is the top-level tab; `subNavLabel` on a collection is its pill
// within that group's sub-nav.
export const COLLECTIONS = {
  listings: {
    key: "listings",
    apiSlug: "listings",
    pageSlug: "/",
    sheetName: "Listings",
    overviewSheetName: "Possible Properties",
    // One-time migration chain, oldest first: each of these gets renamed
    // in place to overviewSheetName above (see ensureOverviewSheet)
    // instead of leaving an orphaned tab behind, the first time a tab by
    // any of these old names is found.
    legacyOverviewSheetNames: ["Overview", "Properties Overview"],
    label: "House Options",
    subNavLabel: "Possible Houses",
    addPlaceholder: "Paste an Airbnb, VRBO, or other listing URL...",
    emptyMessage: "No listings yet — paste a URL above.",
    showBedBath: true,
  },
  stayed: {
    key: "stayed",
    apiSlug: "stayed",
    pageSlug: "/houses/previous-stays",
    sheetName: "Stayed",
    overviewSheetName: "Previous Properties",
    legacyOverviewSheetNames: ["Stayed Overview"],
    label: "Stayed Before",
    subNavLabel: "Previous Stays",
    addPlaceholder: "Paste a link for a place we've stayed before...",
    emptyMessage: "No past stays yet — paste a link above.",
    showBedBath: true,
  },
  foodDrink: {
    key: "foodDrink",
    apiSlug: "food-drink",
    pageSlug: "/food-drink",
    sheetName: "FoodDrink",
    overviewSheetName: "Possible Food & Drinks",
    legacyOverviewSheetNames: ["Food & Drink Overview"],
    label: "Food & Drink",
    subNavLabel: "Food & Drink",
    addPlaceholder: "Paste a link for a bar or restaurant we like...",
    emptyMessage: "No spots yet — paste a link above.",
    showBedBath: false,
  },
  visitedFoodDrink: {
    key: "visitedFoodDrink",
    apiSlug: "visited-food-drink",
    pageSlug: "/food-drink/previously-visited",
    sheetName: "VisitedFoodDrink",
    overviewSheetName: "Visited Food & Drink",
    label: "Previously Visited Food & Drink",
    subNavLabel: "Previously Visited",
    addPlaceholder: "Paste a link for a bar or restaurant you've already been to...",
    emptyMessage: "No visited spots yet — paste a link above.",
    showBedBath: false,
  },
  activities: {
    key: "activities",
    apiSlug: "activities",
    pageSlug: "/activities",
    sheetName: "Activities",
    overviewSheetName: "Possible Activities",
    legacyOverviewSheetNames: ["Activities Overview"],
    label: "Outdoor Activities",
    subNavLabel: "Activities",
    addPlaceholder: "Paste a link for a hike, tour, or activity...",
    emptyMessage: "No activities yet — paste a link above.",
    showBedBath: false,
  },
  previousActivities: {
    key: "previousActivities",
    apiSlug: "previous-activities",
    pageSlug: "/activities/previous-activities",
    sheetName: "PreviousActivities",
    overviewSheetName: "Previous Activities",
    label: "Previous Activities",
    subNavLabel: "Previous Activities",
    addPlaceholder: "Paste a link for a hike, tour, or activity you've already done...",
    emptyMessage: "No previous activities yet — paste a link above.",
    showBedBath: false,
  },
};

export const COLLECTION_LIST = Object.values(COLLECTIONS);

// Top-level nav: each group is one tab, containing an ordered pair of
// collections (first = default landing page for that tab).
export const GROUPS = [
  { key: "houses", navLabel: "Houses", members: ["listings", "stayed"] },
  { key: "foodDrink", navLabel: "Food & Drink", members: ["foodDrink", "visitedFoodDrink"] },
  { key: "activities", navLabel: "Activities", members: ["activities", "previousActivities"] },
];

export function getCollectionBySlug(slug) {
  return COLLECTION_LIST.find((c) => c.apiSlug === slug) || null;
}
