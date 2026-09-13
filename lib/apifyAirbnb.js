// Fallback for when our own direct fetch of an Airbnb listing (see
// lib/scrape.js) gets blocked or comes back without real data — calls
// the "Airbnb Scraper" actor on Apify (apify.com/curious_coder/airbnb-scraper),
// which runs from Apify's own infrastructure instead of ours. Confirmed
// live: it correctly returned full real data (title, description,
// photos, coordinates) for a listing that worked fine directly, and a
// clear "Listing is no longer available" for one that didn't — more
// useful either way than our own best-effort warnings alone.
//
// Configured via APIFY_API_TOKEN + APIFY_AIRBNB_ACTOR_ID (see
// .env.local) — returns null immediately if either is unset, so this
// stays fully optional and never blocks the direct-scrape path for
// anyone who hasn't set it up.
export async function scrapeAirbnbViaApify(url) {
  const token = process.env.APIFY_API_TOKEN;
  const actorId = process.env.APIFY_AIRBNB_ACTOR_ID;
  if (!token || !actorId) return null;

  let res;
  try {
    res = await fetch(
      `https://api.apify.com/v2/acts/${encodeURIComponent(actorId)}/run-sync-get-dataset-items?token=${token}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urls: [url], scrapeDetail: true }),
        signal: AbortSignal.timeout(90000), // a real scrape run isn't instant
      }
    );
  } catch {
    return null; // network hiccup/timeout — the direct-scrape's own warnings still apply
  }
  if (!res.ok) return null;

  let items;
  try {
    items = await res.json();
  } catch {
    return null;
  }
  const item = items?.[0];
  if (!item) return null;

  // The actor reports this plainly (e.g. "Listing is no longer
  // available") rather than just an empty result — surface it
  // verbatim, it's more authoritative than anything we could infer.
  if (item.error) return { unavailable: item.error };

  return {
    title: item.title || null,
    description: item.description || null,
    posterImage: item.photos?.[0]?.url || null,
    lat: typeof item.location?.latitude === "number" ? item.location.latitude : null,
    lng: typeof item.location?.longitude === "number" ? item.location.longitude : null,
    price: item.costPerNight != null ? String(item.costPerNight) : null,
  };
}
