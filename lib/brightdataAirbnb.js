// Third-tier fallback for an Airbnb listing that beats both our own
// direct fetch (lib/scrape.js) and the Apify actor (lib/apifyAirbnb.js)
// — Bright Data uses real residential IPs plus a managed browser,
// independently benchmarked as the most reliable option against
// Airbnb's harder anti-scraping defenses. Confirmed live: richer data
// than Apify (full photo set, 288-day availability calendar, reviews)
// for listings it can reach — though also confirmed some
// professionally-managed listings defeat even this, with real
// sustained effort (135s, not a fast bail-out), not just ours.
//
// A real run has taken anywhere from ~8s (a fast failure) to 135s
// (genuine effort) in testing — too slow for a single request/response
// cycle, so this is a trigger + poll pair rather than one call; the
// deep-preview route and AddEntryForm's "Try a deeper search" button
// drive the polling from the client instead.
//
// Configured via BRIGHTDATA_API_TOKEN (see .env.local); both functions
// return null/"failed" immediately if it's unset.
const DATASET_ID = "gd_ld7ll037kqy322v05"; // Bright Data's public Airbnb "collect by URL" collector

export async function triggerBrightDataAirbnbScrape(url) {
  const token = process.env.BRIGHTDATA_API_TOKEN;
  if (!token) return null;
  try {
    const res = await fetch(
      `https://api.brightdata.com/datasets/v3/trigger?dataset_id=${DATASET_ID}&format=json`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify([{ url, country: "us" }]),
        signal: AbortSignal.timeout(20000),
      }
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data?.snapshot_id || null;
  } catch {
    return null;
  }
}

// Returns { status: "pending" } while still running, { status: "failed" }
// on a hard error, or { status: "ready", result } — result is null if
// the run completed but found nothing (Bright Data's own "0 records"
// case, seen live on a listing all four scrapers we tried failed on),
// otherwise the normalized listing data.
export async function pollBrightDataSnapshot(snapshotId) {
  const token = process.env.BRIGHTDATA_API_TOKEN;
  if (!token || !snapshotId) return { status: "failed" };

  let progress;
  try {
    const res = await fetch(`https://api.brightdata.com/datasets/v3/progress/${snapshotId}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return { status: "failed" };
    progress = await res.json();
  } catch {
    return { status: "failed" };
  }

  if (progress.status === "failed") return { status: "failed" };
  if (progress.status !== "ready") return { status: "pending" };

  try {
    const res = await fetch(`https://api.brightdata.com/datasets/v3/snapshot/${snapshotId}?format=json`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) return { status: "failed" };
    const items = await res.json();
    const item = items?.[0];
    // A failed-to-scrape URL comes back as just {timestamp, input}
    // echoed back, with none of the real fields below present.
    if (!item || (!item.name && !item.listing_title)) {
      return { status: "ready", result: null };
    }
    return {
      status: "ready",
      result: {
        title: item.listing_title || item.name || null,
        description: item.description || null,
        posterImage: item.image || (Array.isArray(item.images) ? item.images[0] : null) || null,
        lat: typeof item.lat === "number" ? item.lat : null,
        lng: typeof item.long === "number" ? item.long : null,
      },
    };
  } catch {
    return { status: "failed" };
  }
}
