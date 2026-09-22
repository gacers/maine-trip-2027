#!/usr/bin/env node
// One-off: copy external images into R2 for *original* rows only, then
 // point synced references at the same owned URL (no second download).
 //
 // Originals:
 //   entries where import_source_entry_id is null
 //   place_items / future_interest_items where source_entry_id is null
 //   trips.cover_image (always original)
 // References:
 //   synced entries / places / FI that point at a source — poster_image
 //   is copied from the source after the source is owned.
//
// Usage: npx tsx --env-file=.env.local scripts/backfill-posters.ts
// Optional: DRY_RUN=1

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

const urlCache = new Map<string, string>();

async function ownUrl(source: string): Promise<string> {
  const cached = urlCache.get(source);
  if (cached) return cached;
  const owned = await ensureOwnedPosterImage(source);
  const result = owned || source;
  urlCache.set(source, result);
  return result;
}

async function fetchPaged(
  table: string,
  select: string,
  apply?: (q: ReturnType<typeof supabase.from>) => ReturnType<typeof supabase.from>
): Promise<Record<string, unknown>[]> {
  const pageSize = 1000;
  const rows: Record<string, unknown>[] = [];
  for (let from = 0; ; from += pageSize) {
    let q = supabase.from(table).select(select).range(from, from + pageSize - 1);
    if (apply) q = apply(q) as typeof q;
    const { data, error } = await q;
    if (error) throw new Error(`${table}: ${error.message}`);
    if (!data?.length) break;
    rows.push(...(data as Record<string, unknown>[]));
    if (data.length < pageSize) break;
  }
  return rows;
}

async function ingestColumn(opts: {
  label: string;
  table: string;
  column: "poster_image" | "cover_image";
  originalFilter: (q: ReturnType<typeof supabase.from>) => ReturnType<typeof supabase.from>;
}) {
  const { label, table, column, originalFilter } = opts;
  const rows = await fetchPaged(table, `id, ${column}`, (q) =>
    originalFilter(q.not(column, "is", null).neq(column, ""))
  );

  let skippedOwned = 0;
  let updated = 0;
  let unchanged = 0;
  let failed = 0;

  console.log(`\n${label}: ${rows.length} original rows with ${column}`);

  for (const row of rows) {
    const id = row.id as string;
    const src = String(row[column] || "").trim();
    if (!src) continue;
    if (isOwnedPosterUrl(src)) {
      skippedOwned += 1;
      continue;
    }
    try {
      const next = await ownUrl(src);
      if (next === src) {
        unchanged += 1;
        console.warn(`  keep (ingest failed): ${table}/${id}`);
        continue;
      }
      if (DRY_RUN) {
        console.log(`  DRY ${table}/${id}`);
        updated += 1;
        continue;
      }
      const { error } = await supabase.from(table).update({ [column]: next }).eq("id", id);
      if (error) throw new Error(error.message);
      updated += 1;
      console.log(`  ok ${table}/${id}`);
    } catch (err) {
      failed += 1;
      console.error(`  fail ${table}/${id}:`, (err as Error).message);
    }
  }

  console.log(
    `${label} done — updated ${updated}, already-owned ${skippedOwned}, unchanged ${unchanged}, failed ${failed}`
  );
}

/** After originals are owned, copy poster_image onto synced copies. */
async function syncEntryReferences() {
  const refs = await fetchPaged(
    "entries",
    "id, poster_image, import_source_entry_id",
    (q) => q.not("import_source_entry_id", "is", null)
  );
  const originals = await fetchPaged("entries", "id, poster_image, import_source_entry_id");
  const byId = new Map(originals.map((r) => [r.id as string, r]));

  function rootPoster(id: string): string | null {
    let cur = byId.get(id);
    const seen = new Set<string>();
    for (let hops = 0; cur && hops < 12; hops++) {
      if (seen.has(cur.id as string)) break;
      seen.add(cur.id as string);
      const srcId = cur.import_source_entry_id as string | null;
      if (!srcId) {
        const url = String(cur.poster_image || "").trim();
        return url || null;
      }
      cur = byId.get(srcId);
    }
    return null;
  }

  let updated = 0;
  let skipped = 0;
  console.log(`\nSync entry references: ${refs.length} synced rows`);

  for (const row of refs) {
    const id = row.id as string;
    const owned = rootPoster(row.import_source_entry_id as string);
    if (!owned || !isOwnedPosterUrl(owned)) {
      skipped += 1;
      continue;
    }
    if (String(row.poster_image || "") === owned) {
      skipped += 1;
      continue;
    }
    if (DRY_RUN) {
      console.log(`  DRY sync entries/${id}`);
      updated += 1;
      continue;
    }
    const { error } = await supabase.from("entries").update({ poster_image: owned }).eq("id", id);
    if (error) {
      console.error(`  fail sync entries/${id}:`, error.message);
      continue;
    }
    updated += 1;
    // Keep in-memory map current for chains.
    const mapped = byId.get(id);
    if (mapped) mapped.poster_image = owned;
    console.log(`  sync entries/${id}`);
  }

  console.log(`entry refs done — updated ${updated}, skipped ${skipped}`);
}

async function syncLinkedTable(table: "place_items" | "future_interest_items") {
  const rows = await fetchPaged(table, "id, poster_image, source_entry_id", (q) =>
    q.not("source_entry_id", "is", null)
  );
  if (rows.length === 0) {
    console.log(`\n${table} refs: none`);
    return;
  }

  const entryIds = [...new Set(rows.map((r) => r.source_entry_id as string))];
  const { data: entries, error } = await supabase.from("entries").select("id, poster_image").in("id", entryIds);
  if (error) throw new Error(error.message);
  const posterByEntry = new Map((entries || []).map((e) => [e.id as string, String(e.poster_image || "").trim()]));

  let updated = 0;
  let skipped = 0;
  console.log(`\nSync ${table} refs: ${rows.length}`);

  for (const row of rows) {
    const id = row.id as string;
    const owned = posterByEntry.get(row.source_entry_id as string) || "";
    if (!owned || !isOwnedPosterUrl(owned)) {
      skipped += 1;
      continue;
    }
    if (String(row.poster_image || "") === owned) {
      skipped += 1;
      continue;
    }
    if (DRY_RUN) {
      console.log(`  DRY sync ${table}/${id}`);
      updated += 1;
      continue;
    }
    const { error: updErr } = await supabase.from(table).update({ poster_image: owned }).eq("id", id);
    if (updErr) {
      console.error(`  fail sync ${table}/${id}:`, updErr.message);
      continue;
    }
    updated += 1;
    console.log(`  sync ${table}/${id}`);
  }

  console.log(`${table} refs done — updated ${updated}, skipped ${skipped}`);
}

async function main() {
  console.log(DRY_RUN ? "DRY RUN — no DB writes" : "Owning originals, then syncing references…");

  await ingestColumn({
    label: "entries (originals)",
    table: "entries",
    column: "poster_image",
    originalFilter: (q) => q.is("import_source_entry_id", null),
  });

  await ingestColumn({
    label: "place_items (originals)",
    table: "place_items",
    column: "poster_image",
    originalFilter: (q) => q.is("source_entry_id", null),
  });

  await ingestColumn({
    label: "future_interest_items (originals)",
    table: "future_interest_items",
    column: "poster_image",
    originalFilter: (q) => q.is("source_entry_id", null),
  });

  await ingestColumn({
    label: "trips (cover images)",
    table: "trips",
    column: "cover_image",
    originalFilter: (q) => q,
  });

  await syncEntryReferences();
  await syncLinkedTable("place_items");
  await syncLinkedTable("future_interest_items");

  console.log("\nDone.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
