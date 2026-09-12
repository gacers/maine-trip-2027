// Config for every "collection" the site tracks. Each one gets its own
// hidden raw sheet tab + human-friendly Overview tab (same schema), its
// own API routes (via the [collection] dynamic segment), and its own
// page route — all driven by this one config object rather than
// duplicated per collection.
export const COLLECTIONS = {
  listings: {
    key: "listings",
    apiSlug: "listings",
    pageSlug: "/",
    sheetName: "Listings",
    overviewSheetName: "Overview",
    label: "House Options",
    navLabel: "Houses",
    addPlaceholder: "Paste an Airbnb, VRBO, or other listing URL...",
    emptyMessage: "No listings yet — paste a URL above.",
    showBedBath: true,
  },
  stayed: {
    key: "stayed",
    apiSlug: "stayed",
    pageSlug: "/stayed",
    sheetName: "Stayed",
    overviewSheetName: "Stayed Overview",
    label: "Stayed Before",
    navLabel: "Stayed Before",
    addPlaceholder: "Paste a link for a place we've stayed before...",
    emptyMessage: "No past stays yet — paste a link above.",
    showBedBath: true,
  },
  foodDrink: {
    key: "foodDrink",
    apiSlug: "food-drink",
    pageSlug: "/food-drink",
    sheetName: "FoodDrink",
    overviewSheetName: "Food & Drink Overview",
    label: "Food & Drink",
    navLabel: "Food & Drink",
    addPlaceholder: "Paste a link for a bar or restaurant we like...",
    emptyMessage: "No spots yet — paste a link above.",
    showBedBath: false,
  },
  activities: {
    key: "activities",
    apiSlug: "activities",
    pageSlug: "/activities",
    sheetName: "Activities",
    overviewSheetName: "Activities Overview",
    label: "Outdoor Activities",
    navLabel: "Activities",
    addPlaceholder: "Paste a link for a hike, tour, or activity...",
    emptyMessage: "No activities yet — paste a link above.",
    showBedBath: false,
  },
};

export const COLLECTION_LIST = Object.values(COLLECTIONS);

export function getCollectionBySlug(slug) {
  return COLLECTION_LIST.find((c) => c.apiSlug === slug) || null;
}
