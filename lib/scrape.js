// Best-effort extraction of listing details from a public Airbnb URL.
// Airbnb has no public API for this and can rate-limit or bot-check
// automated fetches, so every field here is optional: the caller must be
// ready to show a manual-entry form for whatever comes back empty.

export function normalizeAirbnbUrl(rawUrl) {
  const u = new URL(rawUrl);
  const match = u.pathname.match(/\/rooms\/(\d+)/);
  if (match) {
    return `https://www.airbnb.com/rooms/${match[1]}`;
  }
  // Not a recognized Airbnb room URL shape; fall back to origin+pathname with no query/hash.
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
  const m = html.match(re) || html.match(altRe);
  return m ? m[1] : null;
}

function extractFirstPrice(html) {
  // Airbnb's SSR payload embeds price data under varying key names depending
  // on experiment/version. Try a few common shapes; first match wins.
  const patterns = [
    /"priceString"\s*:\s*"([^"]+)"/i,
    /"formattedPrice"\s*:\s*"([^"]+)"/i,
    /"amount"\s*:\s*"?(\d+(?:\.\d+)?)"?\s*,\s*"currency"\s*:\s*"([A-Z]{3})"/i,
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m) {
      if (m.length === 3) return `${m[2]} ${m[1]}`;
      return m[1];
    }
  }
  return null;
}

function extractFirstLatLng(html) {
  const m = html.match(/"lat"\s*:\s*(-?\d+\.\d+)\s*,\s*"lng"\s*:\s*(-?\d+\.\d+)/i);
  if (m) return { lat: parseFloat(m[1]), lng: parseFloat(m[2]) };
  const alt = html.match(/"latitude"\s*:\s*(-?\d+\.\d+)\s*,\s*"longitude"\s*:\s*(-?\d+\.\d+)/i);
  if (alt) return { lat: parseFloat(alt[1]), lng: parseFloat(alt[2]) };
  return null;
}

export async function scrapeAirbnbListing(rawUrl) {
  const normalizedUrl = normalizeAirbnbUrl(rawUrl);
  const result = {
    normalizedUrl,
    title: null,
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
        `Airbnb returned HTTP ${res.status} — it may be blocking automated requests. Fill in the fields below manually.`
      );
      return result;
    }
    html = await res.text();
  } catch (err) {
    result.warnings.push(
      `Couldn't reach Airbnb (${err.message}). Fill in the fields below manually.`
    );
    return result;
  }

  const title = extractMeta(html, "og:title");
  if (title) result.title = title.replace(/\s*-\s*Airbnb$/i, "").trim();
  else result.warnings.push("Couldn't find a title — add one manually.");

  const posterImage = extractMeta(html, "og:image");
  if (posterImage) result.posterImage = posterImage;
  else result.warnings.push("Couldn't find a photo — add a link manually if you'd like one.");

  const price = extractFirstPrice(html);
  if (price) result.price = price;
  else result.warnings.push("Couldn't find a price — add it manually.");

  const latLng = extractFirstLatLng(html);
  if (latLng) {
    result.lat = latLng.lat;
    result.lng = latLng.lng;
  } else {
    result.warnings.push("Couldn't find a location — add lat/lng manually if you want it mapped.");
  }

  return result;
}
