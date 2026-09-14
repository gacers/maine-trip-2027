// Best-effort extraction of listing details from a public listing URL
// (Airbnb, VRBO, or generically any page with reasonable OpenGraph tags).
// These sites have no public API for this and can rate-limit or bot-check
// automated fetches, so every field here is optional: the caller must be
// ready to show a manual-entry form for whatever comes back empty.
//
// Tried and deliberately abandoned before finding the actual fix below:
// chaining paid third-party scraping APIs (Apify, then Bright Data) as
// fallbacks — confirmed live, with real sustained effort across both
// services, that Airbnb's harder-defended (professionally-managed)
// listings defeat all of them the same way they defeat an anonymous
// fetch. Also tried and abandoned: a bookmarklet to read the page from
// the visitor's own browser tab — technically sound but not intuitive
// for non-technical people and didn't hold up in practice.
//
// The actual fix: every one of those attempts was an anonymous,
// logged-out request. Confirmed live that Airbnb serves the exact same
// listing normally to a real, logged-in session cookie — no proxy
// rotation, no managed browser, no vendor needed. AIRBNB_SESSION_COOKIE
// (see .env.local) is a live session token, so — like every other
// credential in this project — it lives in an env var, not the
// database or any admin form: nothing to ever leak through a UI, no
// HTTP response ever touches it. It will eventually expire and need
// replacing there directly (same steps: log into airbnb.com, DevTools
// → Network → any airbnb.com request → copy the "cookie" request
// header value).
//
// VRBO does *not* need the same treatment — confirmed live (a plain
// anonymous fetch, same headers as below) that VRBO serves its real
// property page with no block/wall at all, unlike Airbnb. Its gaps are
// a parsing problem, not an access problem: VRBO has no listing JSON-LD
// block (title/description/image already fall back to og: meta tags,
// which work fine), lat/lng lives in schema.org *microdata* instead
// (<meta itemProp="latitude"/"longitude">, handled by a dedicated
// pattern in extractFirstLatLng below), and price genuinely isn't in
// the static HTML at all — it's fetched client-side once dates are
// picked, so that one has no scrape fix and stays manual entry.

export function normalizeListingUrl(rawUrl: string): string {
  const u = new URL(rawUrl);
  const host = u.hostname.replace(/^www\./, "");

  if (host.includes("airbnb.")) {
    const match = u.pathname.match(/\/rooms\/(\d+)/);
    if (match) return `https://www.airbnb.com/rooms/${match[1]}`;
  }

  if (host.includes("vrbo.") || host.includes("homeaway.")) {
    // VRBO listing paths look like /1234567ha or /property/1234567 or
    // /vacation-rental/pXXXXXXX; keep the path, drop query/fragment/tracking.
    return `https://${host}${u.pathname}`;
  }

  // Generic fallback: strip query string and fragment (usually just tracking).
  return `${u.origin}${u.pathname}`;
}

// Meta tag content comes through HTML-entity-escaped (VRBO's own
// og:description has a plain apostrophe as &#x27;, for instance) —
// decoded once here so every extractMeta caller gets real text, not a
// title/description full of literal &amp;/&#x27; noise.
function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&#x2F;|&#47;/g, "/")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex: string) => String.fromCharCode(parseInt(hex, 16)));
}

function extractMeta(html: string, property: string): string | null {
  const re = new RegExp(`<meta[^>]+property=["']${property}["'][^>]+content=["']([^"']*)["']`, "i");
  const altRe = new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+property=["']${property}["']`, "i");
  const nameRe = new RegExp(`<meta[^>]+name=["']${property}["'][^>]+content=["']([^"']*)["']`, "i");
  const m = html.match(re) || html.match(altRe) || html.match(nameRe);
  return m ? decodeHtmlEntities(m[1]) : null;
}

function extractFirstPrice(html: string): string | null {
  // Try a handful of common shapes across Airbnb/VRBO/generic listing pages.
  // First match wins; this is inherently fragile and best-effort.
  const patterns = [
    /"priceString"\s*:\s*"([^"]+)"/i,
    /"formattedPrice"\s*:\s*"([^"]+)"/i,
    /content=["']USD\s*([\d,.]+)["']\s+property=["']product:price:amount["']/i,
    /property=["']product:price:amount["'][^>]+content=["']([\d,.]+)["']/i,
    /"amount"\s*:\s*"?(\d+(?:\.\d+)?)"?\s*,\s*"currency"\s*:\s*"([A-Z]{3})"/i,
    /\$\s?[\d][\d,]*(?:\.\d{2})?\s*(?:\/\s?night|per night)/i,
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m) {
      if (m.length === 3 && m[2]) return `${m[2]} ${m[1]}`;
      return m[0].length < 40 ? m[0].trim() : m[1];
    }
  }
  return null;
}

function extractFirstLatLng(html: string): { lat: number; lng: number } | null {
  const patterns = [
    /"lat"\s*:\s*(-?\d+\.\d+)\s*,\s*"lng"\s*:\s*(-?\d+\.\d+)/i,
    /"latitude"\s*:\s*(-?\d+\.\d+)\s*,\s*"longitude"\s*:\s*(-?\d+\.\d+)/i,
    // VRBO (confirmed by hand — no cookie/access problem, VRBO serves
    // its real page to a plain anonymous request just fine, unlike
    // Airbnb): doesn't embed a listing JSON-LD block at all, and has no
    // inline JSON lat/lng either — coordinates live in schema.org
    // *microdata* instead, a pair of <meta itemProp="latitude"/
    // "longitude"> tags. A completely different shape from the two
    // JSON patterns above, so those never matched it.
    /itemprop=["']latitude["']\s+content=["'](-?\d+(?:\.\d+)?)["']\s*\/?>\s*<meta[^>]+itemprop=["']longitude["']\s+content=["'](-?\d+(?:\.\d+)?)["']/i,
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m) return { lat: parseFloat(m[1]), lng: parseFloat(m[2]) };
  }
  return null;
}

// Confirmed by hand: Airbnb (and plenty of other listing/rental sites)
// embed a schema.org JSON-LD block with the host's own real title and
// description — completely separate from, and far better than, the
// generic templated og:title ("Rental unit in <town> · ★4.89 · 1
// bedroom · 2 beds · 1 bath") the rest of this file was relying on
// alone. Tries every <script type="application/ld+json"> block (a page
// can have several) and returns the first one matching a known
// listing-ish @type.
const LISTING_JSONLD_TYPES = ["VacationRental", "LodgingBusiness", "House", "Apartment", "Product"];

interface JsonLdListing {
  "@type"?: string;
  name?: string;
  description?: string;
  image?: string | string[];
  latitude?: number;
  longitude?: number;
}

function extractJsonLd(html: string): JsonLdListing | null {
  const scriptRe = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g;
  let match: RegExpExecArray | null;
  while ((match = scriptRe.exec(html)) !== null) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(match[1]);
    } catch {
      continue; // malformed/truncated block — try the next one
    }
    for (const item of Array.isArray(parsed) ? parsed : [parsed]) {
      if (item && LISTING_JSONLD_TYPES.includes(item["@type"])) return item;
    }
  }
  return null;
}

export interface ScrapeResult {
  normalizedUrl: string;
  title: string | null;
  description: string | null;
  price: string | null;
  posterImage: string | null;
  lat: number | null;
  lng: number | null;
  warnings: string[];
  cookieWarning: string | null;
}

export async function scrapeListing(rawUrl: string): Promise<ScrapeResult> {
  const normalizedUrl = normalizeListingUrl(rawUrl);
  const isAirbnb = new URL(normalizedUrl).hostname.replace(/^www\./, "").includes("airbnb.");
  const result: ScrapeResult = {
    normalizedUrl,
    title: null,
    description: null,
    price: null,
    posterImage: null,
    lat: null,
    lng: null,
    warnings: [],
    // Set only for the specific Airbnb-cookie failure mode, so the UI can
    // call this out distinctly (louder than the generic warnings list)
    // instead of it reading like just another "couldn't find a price"-type
    // note — this is the one warning that means "an admin needs to go
    // replace AIRBNB_SESSION_COOKIE," not "fill in a field by hand."
    cookieWarning: null,
  };

  let html: string | null = null;
  let blockedReason: string | null = null;

  try {
    const headers: Record<string, string> = {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
      "Accept-Language": "en-US,en;q=0.9",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    };
    // The whole reason this reliably gets real listing pages instead of
    // a disguised 404 — see the file header for how this was found.
    if (isAirbnb && process.env.AIRBNB_SESSION_COOKIE) {
      headers.Cookie = process.env.AIRBNB_SESSION_COOKIE;
    }
    const res = await fetch(normalizedUrl, { headers, redirect: "follow" });
    if (!res.ok) {
      blockedReason = `The site returned HTTP ${res.status} — it may be blocking automated requests.`;
    } else {
      html = await res.text();
      // Airbnb (confirmed by hand — a listing's real page is 500KB+)
      // serves a genuine-looking "Oops! ... 404 Page Not Found" page
      // with a normal 200 status for a listing that's gone or being
      // blocked as automated traffic, so the plain `!res.ok` check
      // above never catches it.
      if (html.length < 20000 && /404 Page Not Found|page you.re looking for/i.test(html)) {
        if (isAirbnb) {
          result.cookieWarning = process.env.AIRBNB_SESSION_COOKIE
            ? "⚠️ Airbnb didn't return this listing's page — the saved AIRBNB_SESSION_COOKIE has likely expired. An admin needs to log into airbnb.com, grab a fresh session cookie, and update it (see .env.local / Vercel env vars)."
            : "⚠️ No AIRBNB_SESSION_COOKIE is set — Airbnb blocks anonymous requests for some listings. An admin needs to add one (see .env.local for instructions).";
          blockedReason = "Airbnb didn't return this listing's page.";
        } else {
          blockedReason =
            "Airbnb didn't return this listing's page — it may have been removed/delisted, or Airbnb blocked this request.";
        }
        html = null;
      }
    }
  } catch (err) {
    blockedReason = `Couldn't reach that site (${(err as Error).message}).`;
  }

  if (html) {
    const jsonLd = extractJsonLd(html);

    const jsonLdTitle = typeof jsonLd?.name === "string" ? jsonLd.name.trim() : null;
    const ogTitle = extractMeta(html, "og:title");
    // The og:title fallback is a generic template ("Rental unit in
    // <town> · ★4.89 · ..."), not the host's actual listing name —
    // worth stripping the trailing site name at least, same as before.
    result.title = jsonLdTitle || (ogTitle ? ogTitle.replace(/\s*[-|]\s*(Airbnb|Vrbo|VRBO)$/i, "").trim() : null);

    if (typeof jsonLd?.description === "string" && jsonLd.description.trim()) {
      result.description = jsonLd.description.trim();
    } else {
      // VRBO (confirmed by hand): no listing JSON-LD block at all, but
      // a real, specific og:description — this fallback was missing
      // entirely, so a VRBO add always came through with an empty
      // description no matter how good the page's own text was.
      const ogDescription = extractMeta(html, "og:description");
      if (ogDescription) result.description = ogDescription.trim();
    }

    const jsonLdImage = Array.isArray(jsonLd?.image) ? jsonLd.image[0] : jsonLd?.image;
    result.posterImage = jsonLdImage || extractMeta(html, "og:image");

    result.price = extractFirstPrice(html);

    if (typeof jsonLd?.latitude === "number" && typeof jsonLd?.longitude === "number") {
      result.lat = jsonLd.latitude;
      result.lng = jsonLd.longitude;
    } else {
      const latLng = extractFirstLatLng(html);
      if (latLng) {
        result.lat = latLng.lat;
        result.lng = latLng.lng;
      }
    }
  }

  if (!result.title) {
    result.warnings.push(
      blockedReason
        ? `${blockedReason} Double-check the link still works in your own browser, then fill in the fields below manually.`
        : "Couldn't find a title — add one manually."
    );
  }
  if (!result.posterImage) {
    result.warnings.push("Couldn't find a photo — add a link manually if you'd like one.");
  }
  if (!result.price) {
    result.warnings.push("Couldn't find a price — add it manually.");
  }
  if (result.lat == null || result.lng == null) {
    result.warnings.push("Couldn't find a location — add lat/lng manually if you want it mapped.");
  }

  return result;
}
