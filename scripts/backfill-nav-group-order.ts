#!/usr/bin/env node
// One-off: most trips' nav_groups ended up with every row tied at
// sort_order 999 (see app/api/trips/[tripSlug]/sections/route.ts's own
// insert, which hardcoded that value for every brand-new group instead
// of computing the next real one — fixed alongside this script). A tie
// means "first section" (the homepage's own trip-card link, and each
// trip's own top nav tab order) depends on undefined tie-breaking
// rather than actual intent.
//
// Reassigns sequential sort_order per trip, wherever every one of that
// trip's nav_groups currently shares the exact same value: the three
// built-in slugs first, in their usual stays/food-drink/activities
// order (whichever of those three actually exist), then any custom
// groups ordered by the earliest sections.created_at under each (the
// one real historical signal available — nav_groups itself has no
// created_at column). Trips already showing distinct sort_order values
// are left completely untouched.
//
// Usage: npx tsx --env-file=.env.local scripts/backfill-nav-group-order.ts
// Optional: DRY_RUN=1

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DRY_RUN = process.env.DRY_RUN === "1" || process.env.DRY_RUN === "true";

if (!SUPABASE_URL || !SERVICE_KEY) {
  throw new Error(
    "Need NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY — run with: npx tsx --env-file=.env.local scripts/backfill-nav-group-order.ts"
  );
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const BUILTIN_ORDER = ["stays", "food-drink", "activities"];

interface NavGroupRow {
  id: string;
  trip_id: string;
  slug: string;
  sort_order: number;
}

async function main() {
  console.log(DRY_RUN ? "DRY RUN — no DB writes" : "Fixing tied nav_group sort_order…");

  const { data: navGroups, error: navError } = await supabase
    .from("nav_groups")
    .select("id, trip_id, slug, sort_order");
  if (navError) throw new Error(navError.message);

  const { data: sections, error: sectionsError } = await supabase
    .from("sections")
    .select("nav_group_id, created_at");
  if (sectionsError) throw new Error(sectionsError.message);

  // Earliest section under each nav group — the closest thing to "when
  // was this group actually started" available in this schema.
  const earliestByGroup = new Map<string, string>();
  for (const s of sections || []) {
    const groupId = s.nav_group_id as string | null;
    if (!groupId) continue;
    const createdAt = s.created_at as string;
    const existing = earliestByGroup.get(groupId);
    if (!existing || createdAt < existing) earliestByGroup.set(groupId, createdAt);
  }

  const byTrip = new Map<string, NavGroupRow[]>();
  for (const g of (navGroups || []) as NavGroupRow[]) {
    const list = byTrip.get(g.trip_id) || [];
    list.push(g);
    byTrip.set(g.trip_id, list);
  }

  let tripsFixed = 0;
  let tripsSkipped = 0;
  let groupsUpdated = 0;

  for (const [tripId, groups] of byTrip) {
    const allTied = groups.every((g) => g.sort_order === groups[0].sort_order);
    if (!allTied || groups.length <= 1) {
      tripsSkipped += 1;
      continue;
    }

    const ordered = [...groups].sort((a, b) => {
      const aBuiltin = BUILTIN_ORDER.indexOf(a.slug);
      const bBuiltin = BUILTIN_ORDER.indexOf(b.slug);
      if (aBuiltin !== -1 || bBuiltin !== -1) {
        if (aBuiltin === -1) return 1;
        if (bBuiltin === -1) return -1;
        return aBuiltin - bBuiltin;
      }
      const aTime = earliestByGroup.get(a.id) || "";
      const bTime = earliestByGroup.get(b.id) || "";
      if (aTime !== bTime) return aTime < bTime ? -1 : 1;
      return a.slug.localeCompare(b.slug);
    });

    console.log(`\ntrip ${tripId}: ${ordered.map((g) => g.slug).join(", ")}`);
    tripsFixed += 1;

    for (let i = 0; i < ordered.length; i++) {
      const g = ordered[i];
      if (DRY_RUN) {
        console.log(`  DRY nav_groups/${g.slug} -> sort_order ${i}`);
        groupsUpdated += 1;
        continue;
      }
      const { error } = await supabase.from("nav_groups").update({ sort_order: i }).eq("id", g.id);
      if (error) {
        console.error(`  fail nav_groups/${g.slug}:`, error.message);
        continue;
      }
      groupsUpdated += 1;
      console.log(`  ok nav_groups/${g.slug} -> sort_order ${i}`);
    }
  }

  console.log(`\nDone — trips fixed: ${tripsFixed}, trips already fine: ${tripsSkipped}, groups updated: ${groupsUpdated}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
