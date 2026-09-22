#!/usr/bin/env node
// One-off: copy every external poster_image into R2 and rewrite the
// DB URL to the owned public path. Same tables the save path covers
// (entries, place_items, future_interest_items). Dead/blocked remote
// URLs are left unchanged. Re-runs skip rows already under
// S3_PUBLIC_BASE_URL. Identical source URLs share one R2 object.
//
// Usage: npx tsx --env-file=.env.local scripts/backfill-posters.ts
// Optional: DRY_RUN=1 to only print what would change.

import { createClient } from "@supabase/supabase-js";
import {
  ensureOwnedPosterImage,
  isMediaStoreConfigured,
  isOwnedPosterUrl,
} from "../lib/mediaStore";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DRY_RUN = process.env.DRY_RUN === "1" || process.env.DRY_RUN === "true";

if (!SUPABASE_URL || !SERVICE_KEY) {
  throw new Error(
    "Need NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY — run with: npx tsx --env-file=.env.local scripts/backfill-posters.ts"
  );
}
if (!isMediaStoreConfigured()) {
  throw new Error("S3_* env vars are not configured — fill them in .env.local first");
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

type Row = { id: string; poster_image: string | null };

const TABLES = ["entries", "place_items", "future_interest_items"] as const;

/** Same remote URL → one owned URL (avoids re-downloading Airbnb thrice). */
const urlCache = new Map<string, string>();

async function fetchAllWithPosters(table: (typeof TABLES)[number]): Promise<Row[]> {
  const pageSize = 1000;
  const rows: Row[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from(table)
      .select("id, poster_image")
      .not("poster_image", "is", null)
      .neq("poster_image", "")
      .range(from, from + pageSize - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    if (!data?.length) break;
    rows.push(...(data as Row[]));
    if (data.length < pageSize) break;
  }
  return rows;
}

async function ownUrl(source: string): Promise<string> {
  const cached = urlCache.get(source);
  if (cached) return cached;
  const owned = await ensureOwnedPosterImage(source);
  const result = owned || source;
  urlCache.set(source, result);
  return result;
}

async function backfillTable(table: (typeof TABLES)[number]) {
  const rows = await fetchAllWithPosters(table);
  let skippedOwned = 0;
  let updated = 0;
  let unchanged = 0;
  let failed = 0;

  console.log(`\n${table}: ${rows.length} rows with poster_image`);

  for (const row of rows) {
    const src = (row.poster_image || "").trim();
    if (!src) continue;
    if (isOwnedPosterUrl(src)) {
      skippedOwned += 1;
      continue;
    }

    try {
      const next = await ownUrl(src);
      if (next === src) {
        // Ingest failed or store returned original — leave DB alone.
        unchanged += 1;
        console.warn(`  keep (ingest failed or identical): ${table}/${row.id}`);
        continue;
      }
      if (DRY_RUN) {
        console.log(`  DRY ${table}/${row.id}: ${src.slice(0, 60)}… → ${next}`);
        updated += 1;
        continue;
      }
      const { error } = await supabase.from(table).update({ poster_image: next }).eq("id", row.id);
      if (error) throw new Error(error.message);
      updated += 1;
      console.log(`  ok ${table}/${row.id}`);
    } catch (err) {
      failed += 1;
      console.error(`  fail ${table}/${row.id}:`, (err as Error).message);
    }
  }

  console.log(
    `${table} done — updated ${updated}, already-owned ${skippedOwned}, unchanged ${unchanged}, failed ${failed}`
  );
}

async function main() {
  console.log(DRY_RUN ? "DRY RUN — no DB writes" : "Writing owned poster URLs to DB…");
  for (const table of TABLES) {
    await backfillTable(table);
  }
  console.log("\nDone.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
