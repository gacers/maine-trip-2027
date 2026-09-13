// Best-effort extraction of listing details from a public listing URL
// (Airbnb, VRBO, or generically any page with reasonable OpenGraph tags).
// These sites have no public API for this and can rate-limit or bot-check
// automated fetches, so every field here is optional: the caller must be
// ready to show a manual-entry form for whatever comes back empty.

export function normalizeListingUrl(rawUrl) {
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

function extractMeta(html, property) {
  const re = new RegExp(
    `<meta[^>]+property=["']${property}["'][^>]+content=["']([^"']*)["']`,
    "i"
  );
  const altRe = new RegExp(
    `<meta[^>]+content=["']([^"']*)["'][^>]+property=["']${property}["']`,
    "i"
  );
  const nameRe = new RegExp(
    `<meta[^>]+name=["']${property}["'][^>]+content=["']([^"']*)["']`,
    "i"
  );
  const m = html.match(re) || html.match(altRe) || html.match(nameRe);
  return m ? m[1] : null;
}

function extractFirstPrice(html) {
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

function extractFirstLatLng(html) {
  const patterns = [
    /"lat"\s*:\s*(-?\d+\.\d+)\s*,\s*"lng"\s*:\s*(-?\d+\.\d+)/i,
    /"latitude"\s*:\s*(-?\d+\.\d+)\s*,\s*"longitude"\s*:\s*(-?\d+\.\d+)/i,
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

function extractJsonLd(html) {
  const scriptRe = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g;
  let match;
  while ((match = scriptRe.exec(html)) !== null) {
    let parsed;
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

export async function scrapeListing(rawUrl) {
  const normalizedUrl = normalizeListingUrl(rawUrl);
  const result = {
    normalizedUrl,
    title: null,
    description: null,
    price: null,
    posterImage: null,
    lat: null,
    lng: null,
    warnings: [],
  };

  let html;
  try {
    const res = await fetch(normalizedUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
      },
      redirect: "follow",
    });
    if (!res.ok) {
      result.warnings.push(
        `The site returned HTTP ${res.status} — it may be blocking automated requests. Fill in the fields below manually.`
      );
      return result;
    }
    html = await res.text();
  } catch (err) {
    result.warnings.push(
      `Couldn't reach that site (${err.message}). Fill in the fields below manually.`
    );
    return result;
  }

  // Airbnb (confirmed by hand — a listing's real page is 500KB+) serves a
  // genuine-looking "Oops! ... 404 Page Not Found" page with a normal 200
  // status for a listing that's gone or being blocked as automated
  // traffic, so the plain `!res.ok` check above never catches it. Worth
  // detecting up front with one clear warning instead of four separate
  // "couldn't find title/photo/price/location" ones that all boil down
  // to the same root cause and read like our scraper is just bad at its
  // job rather than Airbnb not having served a listing page at all.
  if (html.length < 20000 && /404 Page Not Found|page you.re looking for/i.test(html)) {
    result.warnings.push(
      "Airbnb didn't return this listing's page — it may have been removed/delisted, or Airbnb blocked this request. Double-check the link still works in your own browser, then fill in the fields below manually."
    );
    return result;
  }

  const jsonLd = extractJsonLd(html);

  const jsonLdTitle = typeof jsonLd?.name === "string" ? jsonLd.name.trim() : null;
  const ogTitle = extractMeta(html, "og:title");
  // The og:title fallback is a generic template ("Rental unit in <town>
  // · ★4.89 · ..."), not the host's actual listing name — worth
  // stripping the trailing site name at least, same as before.
  result.title = jsonLdTitle || (ogTitle ? ogTitle.replace(/\s*[-|]\s*(Airbnb|Vrbo|VRBO)$/i, "").trim() : null);
  if (!result.title) result.warnings.push("Couldn't find a title — add one manually.");

  if (typeof jsonLd?.description === "string" && jsonLd.description.trim()) {
    result.description = jsonLd.description.trim();
  }

  const jsonLdImage = Array.isArray(jsonLd?.image) ? jsonLd.image[0] : jsonLd?.image;
  const posterImage = jsonLdImage || extractMeta(html, "og:image");
  if (posterImage) result.posterImage = posterImage;
  else result.warnings.push("Couldn't find a photo — add a link manually if you'd like one.");

  const price = extractFirstPrice(html);
  if (price) result.price = price;
  else result.warnings.push("Couldn't find a price — add it manually.");

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
  if (result.lat == null || result.lng == null) {
    result.warnings.push("Couldn't find a location — add lat/lng manually if you want it mapped.");
  }

  return result;
}
