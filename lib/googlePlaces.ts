"use client";

import { loadGoogleMaps } from "@/lib/loadGoogleMaps";
import type { PlaceResult } from "@/lib/types";

// Text-searches Google Places (New) for whatever a friend pasted or
// typed — a name pulled from a Google search URL's q= param, a name
// parsed out of a resolved Maps share link, or just plain text like
// "Eventide Oyster Co." Returns up to 5 candidates with everything
// AddEntryForm needs to fill itself in the moment one is picked (no
// second request for details) — uses the same `places` library already
// loaded by loadGoogleMaps() for the Geocoder, so no new API key.
// Google's own `types` are broad, snake_case category tags shared across
// every business on the map ("point_of_interest", "establishment",
// "food", ...) — worth ignoring, they say nothing (every restaurant has
// all three). The first type past those is usually the specific one
// ("seafood_restaurant", "winery", "bar", ...) and reads fine humanized.
const GENERIC_PLACE_TYPES = new Set(["point_of_interest", "establishment", "food", "store"]);

function humanizeType(type: string): string {
  const words = type.split("_");
  return words.map((w, i) => (i === 0 ? w[0].toUpperCase() + w.slice(1) : w)).join(" ");
}

// A short, human-readable category ("Seafood restaurant", "Winery") to
// fall back on as this entry's description when Google has no
// editorialSummary — much more useful than this place's street address
// (which `address` already covers on its own for the map link), and
// better than leaving the description blank when Google at least knows
// what kind of place this is.
function categoryFromTypes(types: string[] | undefined): string | null {
  const specific = (types || []).find((t) => !GENERIC_PLACE_TYPES.has(t));
  return specific ? humanizeType(specific) : null;
}

// Text-searches Google Places (New) for whatever a friend pasted or
// typed — a name pulled from a Google search URL's q= param, a name
// parsed out of a resolved Maps share link, or just plain text like
// "Eventide Oyster Co." Returns up to 5 candidates with everything
// AddEntryForm needs to fill itself in the moment one is picked (no
// second request for details) — uses the same `places` library already
// loaded by loadGoogleMaps() for the Geocoder, so no new API key.
export async function searchPlacesByText(query: string): Promise<PlaceResult[]> {
  const google = await loadGoogleMaps();
  if (!google.maps.places?.Place?.searchByText) {
    throw new Error(
      'Google Places search isn\'t available — "Places API (New)" may need to be enabled for this project.'
    );
  }
  const { places } = await google.maps.places.Place.searchByText({
    textQuery: query,
    fields: [
      "id",
      "displayName",
      "formattedAddress",
      "location",
      "photos",
      "websiteURI",
      "googleMapsURI",
      "editorialSummary",
      "types",
    ],
    maxResultCount: 5,
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (places || []).map((p: any) => ({
    id: p.id,
    title: p.displayName || "",
    address: p.formattedAddress || "",
    // A real human-written blurb ("Lively raw bar with a New England
    // vibe...") when Google has one — much more useful as this entry's
    // description than its street address, which `address` above still
    // covers on its own for the map/"open in Google Maps" link.
    summary: p.editorialSummary?.text || null,
    category: categoryFromTypes(p.types),
    lat: p.location ? p.location.lat() : null,
    lng: p.location ? p.location.lng() : null,
    website: p.websiteURI || null,
    mapsUrl: p.googleMapsURI || null,
    photoUrl: p.photos && p.photos[0] ? p.photos[0].getURI({ maxWidth: 400 }) : null,
  }));
}
