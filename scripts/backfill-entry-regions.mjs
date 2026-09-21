#!/usr/bin/env node
// One-off: reverse-geocode every entry / future_interest_item with lat/lng
// and stamp country as a finer region when available (US state, UK
// constituent country) or country name otherwise. Uses geocode_cache
// (place-region:…) so re-runs are cheap.
//
// Usage: node --env-file=.env.local scripts/backfill-entry-regions.mjs
// Optional: FORCE_REGIONS="United Kingdom,United States" to ignore cache
// and re-resolve rows whose current country is in that list.

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const API_KEY = process.env.GOOGLE_MAPS_SERVER_API_KEY;

if (!SUPABASE_URL || !SERVICE_KEY || !API_KEY) {
  throw new Error("Need NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, GOOGLE_MAPS_SERVER_API_KEY — run with: node --env-file=.env.local scripts/backfill-entry-regions.mjs");
}

function round(n) {
  return Math.round(n * 1e6) / 1e6;
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
  const text = await res.text();
  if (!text) return null;
  return JSON.parse(text);
}

function regionFromResults(results) {
  for (const r of results || []) {
    const comps = r.address_components || [];
    const countryComp = comps.find((c) => c.types.includes("country"));
    if (!countryComp) continue;
    const isUs = countryComp.short_name === "US" || countryComp.long_name === "United States";
    const isUk =
      countryComp.short_name === "GB" ||
      countryComp.long_name === "United Kingdom" ||
      countryComp.long_name === "United Kingdom of Great Britain and Northern Ireland";
    if (isUs || isUk) {
      const regionComp = comps.find((c) => c.types.includes("administrative_area_level_1"));
      if (regionComp?.long_name) return regionComp.long_name;
    }
    return countryComp.long_name;
  }
  return null;
}

const FORCE_REGIONS = new Set(
  (process.env.FORCE_REGIONS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
);

async function resolveRegion(lat, lng, { bypassCache = false } = {}) {
  const key = `place-region:${round(lat)},${round(lng)}`;
  if (!bypassCache) {
    const cached = await sb(`geocode_cache?cache_key=eq.${encodeURIComponent(key)}&select=result`);
    const cachedCountry = cached?.[0]?.result?.country;
    if (cachedCountry && !FORCE_REGIONS.has(cachedCountry)) return cachedCountry;
  }

  const qs = new URLSearchParams({ latlng: `${lat},${lng}`, key: API_KEY });
  const res = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?${qs}`);
  const data = await res.json();
  if (data.status !== "OK" || !data.results?.length) {
    console.warn(`  geocode ${lat},${lng} -> ${data.status}`);
    return null;
  }
  const country = regionFromResults(data.results);
  if (!country) return null;

  await sb("geocode_cache?on_conflict=cache_key", {
    method: "POST",
    prefer: "resolution=merge-duplicates,return=minimal",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({
      cache_key: key,
      result: { country },
      computed_at: new Date().toISOString(),
    }),
  });
  return country;
}

async function fetchAll(table, select) {
  const pageSize = 1000;
  let from = 0;
  const rows = [];
  for (;;) {
    const batch = await sb(`${table}?select=${select}&lat=not.is.null&lng=not.is.null`, {
      headers: { Range: `${from}-${from + pageSize - 1}` },
    });
    if (!batch?.length) break;
    rows.push(...batch);
    if (batch.length < pageSize) break;
    from += pageSize;
  }
  return rows;
}

async function backfill(table) {
  let rows = await fetchAll(table, "id,lat,lng,country");
  if (FORCE_REGIONS.size > 0) {
    rows = rows.filter((r) => FORCE_REGIONS.has(r.country));
    console.log(`${table}: ${rows.length} rows matching FORCE_REGIONS`);
  } else {
    console.log(`${table}: ${rows.length} rows with coords`);
  }
  let updated = 0;
  let skipped = 0;
  let failed = 0;
  const memo = new Map();

  for (const row of rows) {
    const k = `${round(row.lat)},${round(row.lng)}`;
    let region = memo.get(k);
    if (region === undefined) {
      region = await resolveRegion(row.lat, row.lng, {
        bypassCache: FORCE_REGIONS.has(row.country),
      });
      memo.set(k, region);
      // Gentle pacing for Google when cache misses stack up.
      await new Promise((r) => setTimeout(r, 40));
    }
    if (!region) {
      failed += 1;
      continue;
    }
    if (row.country === region) {
      skipped += 1;
      continue;
    }
    await sb(`${table}?id=eq.${encodeURIComponent(row.id)}`, {
      method: "PATCH",
      prefer: "return=minimal",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ country: region }),
    });
    updated += 1;
    if (updated % 25 === 0) console.log(`  … ${updated} updated`);
  }
  console.log(`${table}: updated=${updated} already-ok=${skipped} failed=${failed}`);
}

if (FORCE_REGIONS.size > 0) console.log("FORCE_REGIONS:", [...FORCE_REGIONS].join(", "));
await backfill("entries");
await backfill("future_interest_items");
console.log("done");
