import { randomBytes } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { sheets_v4 } from "googleapis";
import { getSheetsClient } from "@/lib/googleSheetsAuth";
import { createSheetInDrive } from "@/lib/drive";
import { getAllEntries, toClientEntry } from "@/lib/entries";
import { getRatingsForEntries, summarizeRatings } from "@/lib/ratings";
import { groupUnits } from "@/lib/groupUnits";
import { exportValue as priceExportValue } from "@/lib/fieldTypes/price";
import { hashApiKey } from "@/lib/auth";
import { supabaseServiceRole } from "@/lib/supabaseServer";
import type { Trip, Section, EntryUnit, FieldDef, ClientEntry } from "@/lib/types";

type RankedUnit = EntryUnit & { rank: number };

// A trip's Sheet is meant to be shared freely (link-shareable, no
// Google account needed) — so every link the Sheet generates back to
// the site carries a standing contributor invite (the same mechanism
// as a manually-created invite link, see InviteLinksManager), created
// once per trip and reused on every export rather than one per link.
// That's what turns "I shared the Sheet with a friend" into "they can
// click through and add things" without a separate invite step. Always
// goes through the service-role client — api_keys has no RLS policies
// at all (service-role only, same lockdown as app_admins), and the
// passed-in `supabase` here is sometimes just an admin's own session
// client, which can't touch that table directly.
export async function ensureSheetInviteToken(trip: Trip): Promise<string> {
  if (trip.sheet_invite_token) return trip.sheet_invite_token;

  const service = supabaseServiceRole();
  const token = "sk_" + randomBytes(24).toString("base64url");
  const { data: key, error: keyErr } = await service
    .from("api_keys")
    .insert({
      trip_id: trip.id,
      label: `Google Sheet — ${trip.name}`,
      role: "contributor",
      key_hash: hashApiKey(token),
    })
    .select("id")
    .single();
  if (keyErr) throw new Error(keyErr.message);

  const { error: tripErr } = await service
    .from("trips")
    .update({ sheet_invite_token: token, sheet_invite_key_id: key.id })
    .eq("id", trip.id);
  if (tripErr) throw new Error(tripErr.message);

  trip.sheet_invite_token = token;
  trip.sheet_invite_key_id = key.id;
  return token;
}

// Invalidates whatever's currently embedded in this trip's Sheet (e.g.
// it went somewhere it shouldn't have) and provisions a fresh one — the
// caller is responsible for re-exporting every section afterward so the
// live Sheet's links actually pick up the new token instead of leaving
// stale ones that still work.
export async function rotateSheetInviteToken(trip: Trip): Promise<string> {
  const service = supabaseServiceRole();
  if (trip.sheet_invite_key_id) {
    await service.from("api_keys").update({ revoked: true }).eq("id", trip.sheet_invite_key_id);
  }
  trip.sheet_invite_token = null;
  trip.sheet_invite_key_id = null;
  return ensureSheetInviteToken(trip);
}

export interface ExportResult {
  spreadsheetId: string;
  spreadsheetUrl: string;
}

// Best-effort, presentational Sheets export — one spreadsheet per trip
// (auto-created + shared on first use, see lib/drive.ts), one tab per
// section. Never throws: a hiccup here can't break the actual write
// that triggered it, same philosophy as the old single-trip app's
// syncOverviewSheet. Swallows (and only logs server-side) whatever
// exportSectionOrThrow below actually failed with — fine for this
// silent, automatic-on-every-write caller, but exactly the problem for
// an admin who just clicked "Create the Sheet now" and got a bare
// "Export failed — check server logs" with no way to see those logs
// (confirmed live) — see the /sheet-export route, which calls
// exportSectionOrThrow directly instead so the real error reaches them.
export async function exportSection(supabase: SupabaseClient, trip: Trip, section: Section): Promise<ExportResult | null> {
  try {
    return await exportSectionOrThrow(supabase, trip, section);
  } catch (err) {
    console.error("exportSection failed:", err);
    return null;
  }
}

export async function exportSectionOrThrow(
  supabase: SupabaseClient,
  trip: Trip,
  section: Section
): Promise<ExportResult | null> {
  const rawEntries = await getAllEntries(supabase, section.id);

  // A disabled section, or one nobody's ever added anything to yet,
  // doesn't belong in a shared Sheet at all — it'd just read as a
  // real, empty category worth wondering about, instead of what it
  // actually is (turned off, or simply untouched so far). If it
  // already has a stale tab from before it was disabled/emptied out
  // (or from before this check existed at all), remove it.
  if (!section.enabled || rawEntries.length === 0) {
    if (trip.google_sheet_id) {
      await deleteTabIfExists(await getSheetsClient(), trip.google_sheet_id, sanitizeTabName(section.label));
    }
    // The site's own "Google Sheet" link builds #gid=<sheet_gid> —
    // leaving a stale value here after the tab itself is gone would
    // point that link at a tab that no longer exists.
    if (section.sheet_gid != null) {
      await supabase.from("sections").update({ sheet_gid: null }).eq("id", section.id);
      section.sheet_gid = null;
    }
    return null;
  }

  const { data: settings } = await supabase
    .from("app_settings")
    .select("google_drive_folder_id, site_url")
    .eq("id", true)
    .maybeSingle();

  let spreadsheetId = trip.google_sheet_id;
  let spreadsheetUrl = trip.google_sheet_url;

  if (!spreadsheetId) {
    const created = await createSheetInDrive(trip.name, settings?.google_drive_folder_id);
    spreadsheetId = created.id;
    spreadsheetUrl = created.url;
    await supabase.from("trips").update({ google_sheet_id: spreadsheetId, google_sheet_url: spreadsheetUrl }).eq("id", trip.id);
  }

  const inviteToken = await ensureSheetInviteToken(trip);
  const siteUrl = (settings?.site_url || "").replace(/\/$/, "");
  // A section's slug is only unique within its own nav group now (see
  // migration 0014) — the site link this builds needs both slugs:
  // /{tripSlug}/{navGroupSlug}/{sectionSlug}.
  const { data: navGroup } = await supabase.from("nav_groups").select("slug").eq("id", section.nav_group_id).maybeSingle();
  const navGroupSlug = navGroup?.slug || "";
  const sheets = await getSheetsClient();
  const overviewFields = (section.field_defs || []).filter((f) => f.show_on_overview);
  // Only a still-deciding-among-options list (e.g. Possible Houses) has
  // a meaningful Rank/ratings — matches supports_ranking/
  // supports_ratings on the site itself. No "My Score" column here —
  // a shared spreadsheet has no single "viewer" for that to mean
  // anything to; only the Average Score is a real, static fact worth
  // exporting. The Rank column itself shows up for either toggle —
  // ratings now fully drive it in practice (Possible Houses turned the
  // manual one off), but a future section could still want a plain
  // manual Rank with no ratings at all.
  const showRank = !!section.supports_ranking;
  const showRatings = !!section.supports_ratings;
  const showRankColumn = showRank || showRatings;
  // A plain log-style section (no Status column of its own) still
  // needs some way to show "did this actually happen" once the trip
  // is over — a Status-flavored section instead just enriches its
  // existing "Active" label to "Visited" (see statusLabelFor), so the
  // two never both apply to the same section.
  const showVisitedColumn = trip.completed && !showRankColumn;
  const header = buildHeader(overviewFields, showRankColumn, showRatings, showVisitedColumn);
  const tabName = sanitizeTabName(section.label);
  const { sheetId, lastCol } = await ensureTab(sheets, spreadsheetId!, tabName, header);

  // Lets the site's own "Google Sheet" link jump straight to this
  // section's tab (see Section.sheet_gid) — cheap to just always
  // write, rather than tracking whether it actually changed.
  if (section.sheet_gid !== sheetId) {
    await supabase.from("sections").update({ sheet_gid: sheetId }).eq("id", section.id);
    section.sheet_gid = sheetId;
  }

  let entries: ClientEntry[] = rawEntries.map((row) => toClientEntry(row));
  // Status only means anything for a still-deciding-among-options
  // list (showRankColumn above) — everywhere else, an archived row
  // with no Status column to explain it would just look like a
  // mistake, so it's dropped from the export entirely instead.
  if (!showRankColumn) {
    entries = entries.filter((e) => e.status !== "archived");
  }
  if (showRatings) {
    const ratingsByEntry = await getRatingsForEntries(
      supabase,
      rawEntries.map((e) => e.id)
    );
    entries = entries.map((e) => ({ ...e, ...summarizeRatings(ratingsByEntry[e.id]) }));
  }

  let units: RankedUnit[];
  if (showRatings) {
    // Rank here is computed fresh from Average Score, not the site's
    // manual Rank field — highest average is 1, next is 2, etc.; a tie
    // goes alphabetically by title. The manual Rank field still exists
    // and still drives the site itself, just not this column anymore.
    units = groupUnits(entries)
      .sort((a, b) => {
        const scoreDiff = unitScoreForSort(b) - unitScoreForSort(a);
        return scoreDiff !== 0 ? scoreDiff : unitTitleForSort(a).localeCompare(unitTitleForSort(b));
      })
      .map((u, i) => ({ ...u, rank: i + 1 }));
  } else {
    const sorted = [...entries].sort((a, b) => (a.rank ?? 999999) - (b.rank ?? 999999));
    units = groupUnits(sorted).map((u) => ({
      ...u,
      rank: Math.min(...u.listings.map((l) => l.rank ?? 999999)),
    }));
  }

  // Reordered into up to 3 tiers — visited (once the trip is
  // completed), then everything else still active, then archived —
  // each tier keeping its own existing relative order (Array#sort is
  // stable; this is a partition, not a re-sort within a tier). Skipped
  // entirely pre-completion for a section with no Status column at
  // all (nothing archived ever reaches `units` there to begin with,
  // and visited isn't a meaningful distinction yet — see
  // showVisitedControl on the site itself).
  if (showRankColumn || trip.completed) {
    units = [...units].sort((a, b) => unitTier(a, trip.completed) - unitTier(b, trip.completed));
  }

  const rows = units.map((u) =>
    buildRow(u, overviewFields, trip, section, navGroupSlug, siteUrl, inviteToken, showRankColumn, showRatings, trip.completed, showVisitedColumn)
  );

  await syncTabData(sheets, spreadsheetId!, tabName, lastCol, rows);

  // Same tiering as above: highlight means "not archived" before the
  // trip is completed (still a live option), and narrows to "visited"
  // specifically once it is (an active-but-unvisited row no longer
  // gets the same treatment as one that's actually part of the
  // record) — reset every export either way, see the function itself.
  if (showRankColumn || trip.completed) {
    const highlightCount = units.filter((u) => unitTier(u, trip.completed) === 0).length;
    await applyActiveRowHighlight(sheets, spreadsheetId!, sheetId, highlightCount);
  }

  return { spreadsheetId: spreadsheetId!, spreadsheetUrl: spreadsheetUrl! };
}

// A group has two listings, each with its own average — rank the pair by
// the better of the two, same "at least this good" idea used for the
// site's own My Score/Average Score sort.
function unitScoreForSort(unit: EntryUnit): number {
  const values = unit.listings.map((l) => l.averageScore).filter((v): v is number => v != null);
  return values.length > 0 ? Math.max(...values) : -Infinity;
}

function unitTitleForSort(unit: EntryUnit): string {
  return (unit.listings[0].groupLabel || unit.listings[0].title || "").toLowerCase();
}

// A group's two listings are always both active or both archived in
// practice (pairing only ever exists among active entries — archiving
// one half breaks the pair, see lib/groupUnits.ts), but treating a
// mixed pair as archived only if *every* listing is would still be the
// right call either way: a unit with any active listing left in it is
// still really "on the list."
function unitIsArchived(unit: EntryUnit): boolean {
  return unit.listings.every((l) => l.status === "archived");
}

// A paired option counts as visited if either half does — same
// reasoning as EntryCard's own per-entry control: checking either
// listing means "we did this option," not that only one specific half
// happened.
function unitIsVisited(unit: EntryUnit): boolean {
  return unit.listings.some((l) => l.visited);
}

// Reduces to the exact pre-completion 2-tier ordering (active, then
// archived) when the trip isn't completed yet — visited isn't a
// meaningful distinction before then. Once it is, splits the active
// tier in two: visited first, then everything still just researched.
function unitTier(unit: EntryUnit, tripCompleted: boolean): number {
  if (unitIsArchived(unit)) return tripCompleted ? 2 : 1;
  if (tripCompleted) return unitIsVisited(unit) ? 0 : 1;
  return 0;
}

function sanitizeTabName(label: string): string {
  // Sheets tab names can't contain [ ] * ? : / \ and top out at 100
  // chars — leave headroom since Google may append its own suffix on a
  // name collision.
  return (label || "Sheet").replace(/[[\]*?:/\\]/g, "").slice(0, 90) || "Sheet";
}

// Boolean overview fields (Restaurant, Bar, Winery, Hike, Kayak, ...)
// collapse into one "Type" column instead of one column per field —
// a section can easily grow a dozen of these, and a wall of mostly-
// blank TRUE/FALSE-shaped columns is far less readable than a single
// comma-separated list of whichever ones are actually true.
function splitOverviewFields(overviewFields: FieldDef[]): { plain: FieldDef[]; typeFields: FieldDef[] } {
  const plain = overviewFields.filter((f) => f.field_type !== "boolean");
  const typeFields = overviewFields.filter((f) => f.field_type === "boolean");
  return { plain, typeFields };
}

// `stillDeciding` (showRankColumn at the call site — Rank or Ratings
// is on) gates both Rank and Status: only a still-deciding-among-
// options list (e.g. House Options) has entries worth excluding with a
// reason, so it's the only one that gets a Status column at all —
// everywhere else, exportSection filters archived entries out
// entirely rather than showing them with nothing to explain why.
// showVisitedColumn is that same section's own stand-in for Status
// once the trip's completed — see exportSectionOrThrow.
function buildHeader(overviewFields: FieldDef[], stillDeciding: boolean, showRatings: boolean, showVisitedColumn: boolean): string[] {
  const { plain, typeFields } = splitOverviewFields(overviewFields);
  const header = stillDeciding ? ["Rank", "Property"] : ["Property"];
  for (const f of plain) {
    header.push(f.label);
    if (f.field_type === "price") header.push("Avg/Night");
  }
  if (typeFields.length > 0) header.push("Type");
  if (showRatings) header.push("Average Score");
  if (stillDeciding) header.push("Status");
  if (showVisitedColumn) header.push("Visited");
  header.push("Description", "Concerns", "Notes");
  return header;
}

function colLetter(n: number): string {
  let s = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

// Once the trip is completed, an active row's own label narrows from
// generic "Active" to "Visited"/"Active" depending on whether it's
// actually part of what happened — same distinction showVisitedColumn
// gives a plain log-style section its own column for.
function statusLabelFor(item: ClientEntry, tripCompleted: boolean): string {
  if (item.status === "archived") return `Archived${item.archiveReason ? ` (${item.archiveReason})` : ""}`;
  if (tripCompleted) return item.visited ? "Visited" : "Active";
  return "Active";
}

// "Closed" is the one true boolean type worth leading with — everything
// else in the list is descriptive (Restaurant, Bar, ...), but Closed is
// a status you want to see before scanning the rest, regardless of
// where its field_def happens to sort among the others.
function typeCellFor(item: ClientEntry, typeFields: FieldDef[]): string {
  const active = typeFields.filter((f) => item[f.key]);
  const closed = active.filter((f) => f.key === "closed");
  const rest = active.filter((f) => f.key !== "closed");
  return [...closed, ...rest].map((f) => f.label).join(", ");
}

function buildRow(
  unit: RankedUnit,
  overviewFields: FieldDef[],
  trip: Trip,
  section: Section,
  navGroupSlug: string,
  siteUrl: string,
  inviteToken: string,
  stillDeciding: boolean,
  showRatings: boolean,
  tripCompleted: boolean,
  showVisitedColumn: boolean
): (string | number)[] {
  const anchor = unit.listings.length > 1 ? `group-${unit.listings[0].id}` : `listing-${unit.listings[0].id}`;
  // The invite param comes before the #anchor (query strings precede
  // fragments) and is what turns clicking through from the Sheet into
  // real add/append access on the site — see ensureSheetInviteToken.
  const url = `${siteUrl}/${trip.slug}/${navGroupSlug}/${section.slug}?invite=${inviteToken}#${anchor}`.replace(/"/g, '""');
  const label = unit.listings
    .map((l) => l.title || "")
    .join("\n")
    .replace(/"/g, '""');
  const propertyCell = label ? `=HYPERLINK("${url}", "${label}")` : "";

  const { plain, typeFields } = splitOverviewFields(overviewFields);
  const row: (string | number)[] = stillDeciding ? [unit.rank >= 999999 ? "" : unit.rank, propertyCell] : [propertyCell];
  for (const f of plain) {
    row.push(unit.listings.map((l) => (l[f.key] as string | number | undefined) ?? "").join("\n"));
    // Baked into text rather than a cell-level currency format — a
    // grouped row's cell here is a "\n"-joined multi-line string,
    // which Sheets stores as text and silently ignores numberFormat on
    // (found and fixed for the old single-sheet Overview this session;
    // same fix applies here).
    if (f.field_type === "price") {
      row.push(unit.listings.map((l) => priceExportValue(l[f.key] as string)).join("\n"));
    }
  }
  if (typeFields.length > 0) {
    row.push(unit.listings.map((l) => typeCellFor(l, typeFields)).join("\n"));
  }
  if (showRatings) {
    row.push(unit.listings.map((l) => (l.averageScore != null ? l.averageScore.toFixed(1) : "")).join("\n"));
  }
  if (stillDeciding) {
    row.push(unit.listings.map((l) => statusLabelFor(l, tripCompleted)).join("\n"));
  }
  if (showVisitedColumn) {
    row.push(unit.listings.map((l) => (l.visited ? "Yes" : "")).join("\n"));
  }
  row.push(unit.listings.map((l) => l.description || "").join("\n---\n"));
  row.push(unit.listings.map((l) => l.concerns || "").join("\n---\n"));
  row.push(unit.listings.map((l) => l.notes || "").join("\n---\n"));
  return row;
}

// Removes a section's own tab if it happens to already exist — used
// when a section is disabled or has no entries (see exportSection),
// so a Sheet never carries a stale/misleading tab for something that
// isn't really there anymore. A no-op (not an error) if there's no
// such tab, or if the delete itself fails for some reason — same
// "never throws" philosophy as the rest of this file.
async function deleteTabIfExists(sheets: sheets_v4.Sheets, spreadsheetId: string, tabName: string): Promise<void> {
  try {
    const meta = await sheets.spreadsheets.get({ spreadsheetId });
    const existing = meta.data.sheets?.find((s) => s.properties?.title === tabName);
    if (existing) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: { requests: [{ deleteSheet: { sheetId: existing.properties!.sheetId } }] },
      });
    }
  } catch {
    // non-fatal
  }
}

// Ensures a section's tab exists with the right header (creating it, or
// rewriting just the header if a field was added/removed/renamed since
// last export), and (re)applies formatting that's cheap to redo every
// time: bold header on creation, top-aligned cells always — the same
// grouped-row-Rank-looks-detached fix from the old single-sheet
// Overview, since a paired option's cells here are multi-line too.
async function ensureTab(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string,
  tabName: string,
  header: string[]
): Promise<{ sheetId: number; lastCol: string }> {
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const existing = meta.data.sheets?.find((s) => s.properties?.title === tabName);
  const lastCol = colLetter(header.length);

  let sheetId: number;
  if (!existing) {
    const addRes = await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [{ addSheet: { properties: { title: tabName, gridProperties: { frozenRowCount: 1 } } } }],
      },
    });
    sheetId = addRes.data.replies![0].addSheet!.properties!.sheetId!;

    // Every brand-new spreadsheet comes with one empty default "Sheet1"
    // tab — harmless but unpolished for something friends will actually
    // open. Safe to remove now that a second (this) tab exists.
    const defaultSheet = meta.data.sheets?.find(
      (s) => s.properties?.title === "Sheet1" && s.properties?.sheetId !== sheetId
    );
    if (defaultSheet) {
      try {
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId,
          requestBody: { requests: [{ deleteSheet: { sheetId: defaultSheet.properties!.sheetId } }] },
        });
      } catch {
        // non-fatal
      }
    }

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${tabName}!A1`,
      valueInputOption: "RAW",
      requestBody: { values: [header] },
    });
    try {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [
            {
              repeatCell: {
                range: { sheetId, startRowIndex: 0, endRowIndex: 1 },
                cell: { userEnteredFormat: { textFormat: { bold: true } } },
                fields: "userEnteredFormat.textFormat.bold",
              },
            },
          ],
        },
      });
    } catch {
      // non-fatal
    }
  } else {
    sheetId = existing.properties!.sheetId!;
    const headerRes = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${tabName}!A1:${lastCol}1`,
    });
    const currentHeader = headerRes.data.values ? headerRes.data.values[0] : [];
    if (currentHeader.join("|") !== header.join("|")) {
      await sheets.spreadsheets.values.clear({ spreadsheetId, range: `${tabName}!A1:ZZ` });
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${tabName}!A1`,
        valueInputOption: "RAW",
        requestBody: { values: [header] },
      });
    }
  }

  try {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            repeatCell: {
              range: { sheetId, startRowIndex: 0, endRowIndex: 1000 },
              cell: { userEnteredFormat: { verticalAlignment: "TOP" } },
              fields: "userEnteredFormat.verticalAlignment",
            },
          },
        ],
      },
    });
  } catch {
    // non-fatal
  }

  return { sheetId, lastCol };
}

async function syncTabData(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string,
  tabName: string,
  lastCol: string,
  rows: (string | number)[][]
): Promise<void> {
  await sheets.spreadsheets.values.clear({
    spreadsheetId,
    range: `${tabName}!A2:${lastCol}`,
  });
  if (rows.length > 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${tabName}!A2`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: rows },
    });
  }
}

// A light green background on the first `highlightRowCount` data
// rows — whatever unitTier already sorted to the top (still-active
// before the trip's completed, visited specifically once it is; see
// exportSectionOrThrow). Always resets the whole data range to no fill
// first (row counts shift between exports as things change status),
// otherwise a row that was highlighted on a previous export stays that
// way forever, since clearing cell *values* doesn't touch formatting.
// Same "non-fatal" philosophy as the rest of this file's formatting
// calls — a coloring hiccup can't break the export itself.
async function applyActiveRowHighlight(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string,
  sheetId: number,
  highlightRowCount: number
): Promise<void> {
  try {
    const requests: sheets_v4.Schema$Request[] = [
      {
        repeatCell: {
          range: { sheetId, startRowIndex: 1, endRowIndex: 1000 },
          cell: { userEnteredFormat: { backgroundColor: { red: 1, green: 1, blue: 1 } } },
          fields: "userEnteredFormat.backgroundColor",
        },
      },
    ];
    if (highlightRowCount > 0) {
      requests.push({
        repeatCell: {
          range: { sheetId, startRowIndex: 1, endRowIndex: 1 + highlightRowCount },
          cell: { userEnteredFormat: { backgroundColor: { red: 0.85, green: 0.94, blue: 0.83 } } },
          fields: "userEnteredFormat.backgroundColor",
        },
      });
    }
    await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests } });
  } catch {
    // non-fatal
  }
}
