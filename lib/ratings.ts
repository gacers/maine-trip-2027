import type { SupabaseClient } from "@supabase/supabase-js";

// entry_ratings helpers — kept separate from lib/entries.ts since these
// are bulk/summary operations (one query for a whole section's worth of
// entries), not single-row CRUD.

export interface RatingRow {
  entry_id: string;
  rater_key: string;
  score: number;
}

export async function getRatingsForEntries(
  supabase: SupabaseClient,
  entryIds: string[]
): Promise<Record<string, RatingRow[]>> {
  if (!entryIds || entryIds.length === 0) return {};
  const { data, error } = await supabase
    .from("entry_ratings")
    .select("entry_id, rater_key, score")
    .in("entry_id", entryIds);
  if (error) throw new Error(error.message);
  const byEntry: Record<string, RatingRow[]> = {};
  for (const row of data as RatingRow[]) {
    (byEntry[row.entry_id] ||= []).push(row);
  }
  return byEntry;
}

const DEVICE_HEADER = "x-rater-device";
// Exported for /api/trips/[tripSlug]/become-editor, which needs the
// exact same shape check before trusting a client-supplied device id
// enough to migrate ratings onto a brand-new account (see
// migrateDeviceRatingsToEditor below).
export const DEVICE_ID_RE = /^[a-zA-Z0-9-]{8,64}$/;

// requireWriteAccess's raterKey identifies *how you got in* (an admin
// or editor session, or a specific invite/API token) — fine for admin
// and editor, whose real login is already a stable, personal identity,
// but a contributor's invite token is just a shared gate to the
// features, not a person: two different people using the same link
// would otherwise be counted as one rater. A contributor's browser
// instead sends its own randomly-generated, localStorage-persisted
// device id (see lib/inviteClient.ts's getOrCreateDeviceId) as the
// X-Rater-Device header, and THAT becomes their actual identity for
// scoring — falls back to the token-derived key if the header's
// missing (an older cached page, or a direct API call) rather than
// failing outright.
export function resolveRaterKey(raterKey: string | undefined, request: Request): string | undefined {
  if (!raterKey || raterKey.startsWith("admin:") || raterKey.startsWith("editor:")) return raterKey;
  const deviceId = request.headers.get(DEVICE_HEADER);
  return deviceId && DEVICE_ID_RE.test(deviceId) ? `device:${deviceId}` : raterKey;
}

// Called once, right after /become-editor creates a contributor's
// permanent account — without this, every rating they'd already left
// as `device:<uuid>` (see resolveRaterKey above) would just sit there
// orphaned: their brand-new `editor:<user.id>` identity starts with a
// blank slate, so their own stars would silently reset to empty the
// moment they "upgraded," even though the averages they contributed to
// stay correct either way. Not trip-scoped — the device id is a
// per-browser identity, not a per-trip one, so this sweeps every
// rating that browser ever left anywhere, not just on the trip whose
// invite link they happened to use to sign up. Upsert (not a plain
// UPDATE) because entry_ratings has a unique(entry_id, rater_key)
// constraint a straight rename could violate if this account
// improbably already had its own rating on one of these same entries;
// the device-side one wins since it's the one they were actually
// looking at when they created the account.
export async function migrateDeviceRatingsToEditor(supabase: SupabaseClient, deviceId: string, userId: string): Promise<void> {
  const deviceKey = `device:${deviceId}`;
  const editorKey = `editor:${userId}`;
  const { data: rows, error } = await supabase.from("entry_ratings").select("entry_id, score").eq("rater_key", deviceKey);
  if (error) throw new Error(error.message);
  if (!rows || rows.length === 0) return;

  for (const row of rows) {
    const { error: upsertError } = await supabase
      .from("entry_ratings")
      .upsert({ entry_id: row.entry_id, rater_key: editorKey, score: row.score }, { onConflict: "entry_id,rater_key" });
    if (upsertError) throw new Error(upsertError.message);
  }
  const { error: deleteError } = await supabase.from("entry_ratings").delete().eq("rater_key", deviceKey);
  if (deleteError) throw new Error(deleteError.message);
}

export interface RatingSummary {
  averageScore: number | null;
  ratingCount: number;
  myScore: number | null;
}

// `raterKey` is optional — omit it (e.g. for the Sheet export, which has
// no single "viewer") to just get the average/count.
export function summarizeRatings(rows: RatingRow[] | undefined, raterKey: string | null = null): RatingSummary {
  if (!rows || rows.length === 0) return { averageScore: null, ratingCount: 0, myScore: null };
  const sum = rows.reduce((s, r) => s + Number(r.score), 0);
  const mine = raterKey ? rows.find((r) => r.rater_key === raterKey) : null;
  return {
    averageScore: Math.round((sum / rows.length) * 10) / 10,
    ratingCount: rows.length,
    myScore: mine ? Number(mine.score) : null,
  };
}
