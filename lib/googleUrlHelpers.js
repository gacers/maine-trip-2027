// Recognizes the shapes of URL a friend is likely to paste for a
// restaurant/activity instead of a rental listing — a Google Maps share
// link, a plain Google search results page, or a full Maps URL — none
// of which carry OpenGraph tags lib/scrape.js can read (a location link
// brings back nothing). AddEntryForm uses these to route such input to
// a Places text search instead of the rental-site scraper.

function hostnameOf(value) {
  try {
    return new URL(value).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

export function isPlainUrl(value) {
  return hostnameOf(value) !== null;
}

// share.google/xxxx and maps.app.goo.gl/xxxx both redirect to a full
// Maps URL — resolving that redirect requires a server round-trip (see
// app/api/resolve-url), since google.com blocks it via CORS from
// browser JS. In practice share.google specifically gates its real
// redirect behind an "enable JavaScript" wall for any non-browser
// client, so that resolution attempt fails more often than not — see
// the comment in app/api/resolve-url/route.js. Still worth attempting:
// it's free when it works, and fails with a clear message when it
// doesn't.
export function isGoogleMapsShareUrl(value) {
  const host = hostnameOf(value);
  return host === "share.google" || host === "maps.app.goo.gl";
}

// A plain "google.com/search?q=..." results page — e.g. copied from the
// address bar after searching for a place. The query text is right
// there in the URL, no fetch needed.
export function isGoogleSearchUrl(value) {
  try {
    const u = new URL(value);
    return hostnameOf(value) === "google.com" && u.pathname === "/search" && u.searchParams.has("q");
  } catch {
    return false;
  }
}

export function extractGoogleSearchQuery(value) {
  return new URL(value).searchParams.get("q") || "";
}

// A full (not shortened) Google Maps URL, e.g.
// google.com/maps/place/Eventide+Oyster+Co/@43.65,-70.25,17z/...
export function isGoogleMapsUrl(value) {
  try {
    const u = new URL(value);
    const host = hostnameOf(value);
    return (host === "google.com" || host === "maps.google.com") && u.pathname.startsWith("/maps");
  } catch {
    return false;
  }
}

// Pulls a place name and, if present, coordinates out of a Maps URL's
// own path (`/maps/place/<name>/@<lat>,<lng>,<zoom>z/...`) — best-effort,
// used only to seed the Places text search below with something better
// than the raw URL.
export function parseGoogleMapsUrl(value) {
  const u = new URL(value);
  const nameMatch = u.pathname.match(/\/maps\/place\/([^/]+)/);
  const name = nameMatch ? decodeURIComponent(nameMatch[1].replace(/\+/g, " ")) : null;
  const coordMatch = u.pathname.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  return {
    name,
    lat: coordMatch ? parseFloat(coordMatch[1]) : null,
    lng: coordMatch ? parseFloat(coordMatch[2]) : null,
  };
}
