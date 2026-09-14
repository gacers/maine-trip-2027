#!/usr/bin/env node
// One-off migration (safe to re-run — every step checks before writing):
// seeds the Maine 2027 trip's nav_groups/sections/field_defs, and
// migrates its real "Possible Houses" data into Supabase entries.
//
// Real listing data is fetched from the LIVE deployed site's API
// (https://maine-trip-2027.vercel.app/api/listings) rather than calling
// lib/sheets.js directly — this dev environment doesn't have working
// Google service-account credentials locally (they're marked sensitive
// in Vercel and can't be pulled back via `vercel env pull`), but the
// live site's API already returns exactly the same data those
// credentials would.
//
// Usage: node --env-file=.env.local scripts/migrate-maine-2027.mjs

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const LIVE_SITE = "https://maine-trip-2027.vercel.app";

if (!SUPABASE_URL || !SERVICE_KEY) {
  throw new Error("Missing Supabase env vars — run with: node --env-file=.env.local scripts/migrate-maine-2027.mjs");
}

async function sb(path, options = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      Prefer: options.prefer || "return=representation",
      ...options.headers,
    },
  });
  if (!res.ok) {
    throw new Error(`Supabase ${options.method || "GET"} ${path} -> ${res.status}: ${await res.text()}`);
  }
  return res.status === 204 ? null : res.json();
}

const MAP_CONFIG = {
  alwaysShown: [
    { lat: 44.4089658, lng: -68.2472733, label: "Acadia National Park", color: "#2E7D32" },
    {
      lat: 44.1552157,
      lng: -68.660962,
      // Stonington's ferry to Isle Au Haut also runs a puffin tour, so it
      // competes with the closestOf towns below for "closest puffin tour" —
      // ListingMap.jsx only shows closestLabel when it actually wins that.
      label: "Stonington (Isle Au Haut boat)",
      closestLabel: "Stonington (Isle Au Haut boat & puffin tour)",
      color: "#8E24AA",
      joinClosestOf: true,
    },
  ],
  closestOf: [
    { lat: 43.8722, lng: -69.4873, label: "New Harbor (Hardy Boat puffin tour)", color: "#F57C00" },
    { lat: 44.66444, lng: -67.23944, label: "Cutler (Bold Coast puffin tour)", color: "#F57C00" },
    { lat: 44.392087, lng: -68.204052, label: "Bar Harbor (Puffin Lighthouse Cruise)", color: "#F57C00" },
    { lat: 43.85056, lng: -69.62778, label: "Boothbay Harbor (Cap'n Fish's puffin cruise)", color: "#F57C00" },
  ],
  originLabel: "Brooklyn, NY",
  houseColor: "#CC0000",
  townColor: "#1976D2",
};

const HOUSE_FIELD_DEFS = [
  { key: "price", label: "Price", field_type: "price", storage: "jsonb", show_on_overview: true, sort_order: 0 },
  { key: "bedrooms", label: "Bedrooms", field_type: "count", storage: "jsonb", show_on_overview: true, sort_order: 1 },
  { key: "beds", label: "Beds", field_type: "count", storage: "jsonb", show_on_overview: true, sort_order: 2 },
  {
    key: "bathrooms",
    label: "Bathrooms",
    field_type: "count",
    storage: "jsonb",
    show_on_overview: true,
    sort_order: 3,
    options: { aliases: ["bath", "baths"] },
  },
];

async function upsertTrip() {
  const existing = await sb("trips?slug=eq.maine-2027&select=*");
  if (existing.length > 0) {
    console.log("Trip already exists:", existing[0].id);
    return existing[0];
  }
  const [trip] = await sb("trips", {
    method: "POST",
    body: JSON.stringify({
      slug: "maine-2027",
      name: "Maine Coast Trip — July 2027",
      start_date: "2027-07-01",
      map_config: MAP_CONFIG,
    }),
  });
  console.log("Created trip:", trip.id);
  return trip;
}

async function upsertNavGroup(tripId, slug, label, sortOrder) {
  const existing = await sb(`nav_groups?trip_id=eq.${tripId}&slug=eq.${slug}&select=*`);
  if (existing.length > 0) return existing[0];
  const [group] = await sb("nav_groups", {
    method: "POST",
    body: JSON.stringify({ trip_id: tripId, slug, label, sort_order: sortOrder }),
  });
  console.log("Created nav group:", slug);
  return group;
}

async function upsertSection(tripId, navGroupId, def) {
  const existing = await sb(`sections?trip_id=eq.${tripId}&slug=eq.${def.slug}&select=*`);
  if (existing.length > 0) return existing[0];
  const [section] = await sb("sections", {
    method: "POST",
    body: JSON.stringify({ trip_id: tripId, nav_group_id: navGroupId, ...def }),
  });
  console.log("Created section:", def.slug);
  return section;
}

async function upsertFieldDefs(sectionId, defs) {
  for (const def of defs) {
    const existing = await sb(`field_defs?section_id=eq.${sectionId}&key=eq.${def.key}&select=id`);
    if (existing.length > 0) continue;
    await sb("field_defs", { method: "POST", body: JSON.stringify({ section_id: sectionId, ...def }) });
    console.log("  Created field:", def.key);
  }
}

async function migrateEntries(section, apiSlug) {
  const res = await fetch(`${LIVE_SITE}/api/${apiSlug}`);
  const { listings } = await res.json();
  console.log(`Migrating ${listings.length} entries for "${section.slug}"...`);
  for (const item of listings) {
    const existing = await sb(`entries?id=eq.${item.id}&select=id`);
    if (existing.length > 0) {
      console.log("  already migrated:", item.id);
      continue;
    }
    await sb("entries", {
      method: "POST",
      body: JSON.stringify({
        id: item.id, // preserves the legacy nanoid so #listing-<id> anchors keep resolving
        section_id: section.id,
        rank: item.rank,
        status: item.status,
        archive_reason: item.archiveReason || null,
        notes: item.notes || null,
        concerns: item.concerns || null,
        title: item.title || null,
        url: item.url || null,
        poster_image: item.posterImage || null,
        description: item.description || null,
        lat: item.lat === "" ? null : item.lat,
        lng: item.lng === "" ? null : item.lng,
        group_label: item.groupLabel || null,
        data: {
          price: item.price || "",
          bedrooms: item.bedrooms === "" ? null : item.bedrooms,
          beds: item.beds === "" ? null : item.beds,
          bathrooms: item.bathrooms === "" ? null : item.bathrooms,
        },
      }),
    });
    console.log("  migrated:", item.id, "-", item.title);
  }
}

async function main() {
  const trip = await upsertTrip();

  const housesGroup = await upsertNavGroup(trip.id, "houses", "Houses", 0);
  const foodDrinkGroup = await upsertNavGroup(trip.id, "food-drink", "Food & Drink", 1);
  const activitiesGroup = await upsertNavGroup(trip.id, "activities", "Activities", 2);

  // Pairing (2-item options) and manual ranking only make sense for a
  // still-deciding-among-options list — Possible Houses is the only one:
  // Stayed Before/Previously Visited/Previous Activities are already
  // decided (no map either), and Food & Drink/Activities are lighter,
  // one-at-a-time adds that were never meant to be paired or ranked.
  const houses = await upsertSection(trip.id, housesGroup.id, {
    slug: "houses",
    label: "House Options",
    sub_nav_label: "Possible Houses",
    add_placeholder: "Paste an Airbnb, VRBO, or other listing URL...",
    empty_message: "No listings yet — paste a URL above.",
    supports_pairing: true,
    has_map: true,
    supports_ranking: true,
    sort_order: 0,
  });
  const previousStays = await upsertSection(trip.id, housesGroup.id, {
    slug: "previous-stays",
    label: "Stayed Before",
    sub_nav_label: "Previous Stays",
    add_placeholder: "Paste a link for a place we've stayed before...",
    empty_message: "No past stays yet — paste a link above.",
    supports_pairing: false,
    has_map: false,
    supports_ranking: false,
    sort_order: 1,
  });
  // The other 4 sections have no field defs or data to seed yet — create
  // them for nav/URL completeness, but there's nothing further to do
  // with the returned rows.
  await upsertSection(trip.id, foodDrinkGroup.id, {
    slug: "food-drink",
    label: "Possible Food & Drink",
    sub_nav_label: "Possible Food & Drink",
    add_placeholder: "Paste a link for a bar or restaurant we like...",
    empty_message: "No spots yet — paste a link above.",
    supports_pairing: false,
    has_map: true,
    supports_ranking: false,
    sort_order: 0,
  });
  await upsertSection(trip.id, foodDrinkGroup.id, {
    slug: "previously-visited",
    label: "Previously Visited Food & Drink",
    sub_nav_label: "Previously Visited",
    add_placeholder: "Paste a link for a bar or restaurant you've already been to...",
    empty_message: "No visited spots yet — paste a link above.",
    supports_pairing: false,
    has_map: false,
    supports_ranking: false,
    sort_order: 1,
  });
  await upsertSection(trip.id, activitiesGroup.id, {
    slug: "activities",
    label: "Outdoor Activities",
    sub_nav_label: "Activities",
    add_placeholder: "Paste a link for a hike, tour, or activity...",
    empty_message: "No activities yet — paste a link above.",
    supports_pairing: false,
    has_map: true,
    supports_ranking: false,
    sort_order: 0,
  });
  await upsertSection(trip.id, activitiesGroup.id, {
    slug: "previous-activities",
    label: "Previous Activities",
    sub_nav_label: "Previous Activities",
    add_placeholder: "Paste a link for a hike, tour, or activity you've already done...",
    empty_message: "No previous activities yet — paste a link above.",
    supports_pairing: false,
    has_map: false,
    supports_ranking: false,
    sort_order: 1,
  });

  // Only Houses/Previous Stays get field defs, matching today's
  // showBedBath: true — the other 4 sections start with none.
  await upsertFieldDefs(houses.id, HOUSE_FIELD_DEFS);
  await upsertFieldDefs(previousStays.id, HOUSE_FIELD_DEFS);

  // Only "houses" (today's `listings` collection) has real data to
  // migrate — the other 5 collections are currently empty.
  await migrateEntries(houses, "listings");

  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
