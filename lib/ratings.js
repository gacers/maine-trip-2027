// entry_ratings helpers — kept separate from lib/entries.js since these
// are bulk/summary operations (one query for a whole section's worth of
// entries), not single-row CRUD.

export async function getRatingsForEntries(supabase, entryIds) {
  if (!entryIds || entryIds.length === 0) return {};
  const { data, error } = await supabase
    .from("entry_ratings")
    .select("entry_id, rater_key, score")
    .in("entry_id", entryIds);
  if (error) throw new Error(error.message);
  const byEntry = {};
  for (const row of data) {
    (byEntry[row.entry_id] ||= []).push(row);
  }
  return byEntry;
}

// `raterKey` is optional — omit it (e.g. for the Sheet export, which has
// no single "viewer") to just get the average/count.
export function summarizeRatings(rows, raterKey = null) {
  if (!rows || rows.length === 0) return { averageScore: null, ratingCount: 0, myScore: null };
  const sum = rows.reduce((s, r) => s + Number(r.score), 0);
  const mine = raterKey ? rows.find((r) => r.rater_key === raterKey) : null;
  return {
    averageScore: Math.round((sum / rows.length) * 10) / 10,
    ratingCount: rows.length,
    myScore: mine ? Number(mine.score) : null,
  };
}
