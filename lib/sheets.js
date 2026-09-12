import { google } from "googleapis";
import { groupUnits } from "@/lib/groupUnits";
import { extractAvgPerNight } from "@/lib/priceUtils";

// Same row schema for every collection (house listings, past stays, food
// & drink, activities) — one hidden raw tab + one human-friendly Overview
// tab per collection, all sharing this shape.
// Existing columns (through "groupLabel") MUST keep this exact order —
// every already-written row's data is positional. New fields only ever
// get appended at the end: a header-mismatch rewrite only touches row 1
// text, it doesn't shift any existing row's cells, so inserting a new
// field in the middle would silently misalign every old row's trailing
// columns onto the wrong labels.
const HEADER = [
  "id",
  "rank",
  "title",
  "price",
  "url",
  "posterImage",
  "description",
  "status",
  "archiveReason",
  "lat",
  "lng",
  "extraMarkers",
  "notes",
  "createdAt",
  "siteLink",
  "groupLabel",
  "concerns",
  "bedrooms",
  "beds",
  "bathrooms",
];
const LAST_COL = "T"; // must match HEADER.length (20 columns, A..T)

const OVERVIEW_HEADER = [
  "Rank",
  "Property",
  "Price",
  "Avg/Night",
  "Bedrooms",
  "Beds",
  "Baths",
  "Status",
  "Description",
  "Concerns",
  "Notes",
];
const OVERVIEW_LAST_COL = "K";

function getEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

function getAuth() {
  // Preferred: the whole service-account JSON key, base64-encoded into one
  // env var. Avoids every newline/quote-mangling issue that comes from
  // pasting a multi-line PEM key through a web form field.
  const b64 = process.env.GOOGLE_SERVICE_ACCOUNT_JSON_B64;
  if (b64) {
    let parsed;
    try {
      parsed = JSON.parse(Buffer.from(b64, "base64").toString("utf8"));
    } catch (err) {
      throw new Error(
        `GOOGLE_SERVICE_ACCOUNT_JSON_B64 isn't valid base64-encoded JSON: ${err.message}`
      );
    }
    return new google.auth.JWT({
      email: parsed.client_email,
      key: parsed.private_key,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });
  }

  // Fallback: separate email + private key env vars.
  const email = getEnv("GOOGLE_SERVICE_ACCOUNT_EMAIL");
  // Private keys are stored in env vars with literal \n sequences; convert back to real newlines.
  const key = getEnv("GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY").replace(/\\n/g, "\n");
  return new google.auth.JWT({
    email,
    key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
}

async function getSheetsClient() {
  const auth = getAuth();
  await auth.authorize();
  return google.sheets({ version: "v4", auth });
}

function getSpreadsheetId() {
  return getEnv("GOOGLE_SHEET_ID");
}

function siteBaseUrl() {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000")
  ).replace(/\/$/, "");
}

function collectionPagePath(collection) {
  return collection.pageSlug === "/" ? "" : collection.pageSlug;
}

export function siteLinkFor(collection, id) {
  return `${siteBaseUrl()}${collectionPagePath(collection)}/#listing-${id}`;
}

// Like siteLinkFor, but takes the full anchor (e.g. "group-abc123")
// instead of assuming the "listing-" prefix.
function siteAnchorUrl(collection, anchor) {
  return `${siteBaseUrl()}${collectionPagePath(collection)}/#${anchor}`;
}

// Ensures a collection's raw sheet tab exists with the expected header
// row, and that the whole tab is hidden (it's the raw database — the
// Overview tab is the human-friendly one). Safe to call repeatedly.
async function ensureSheet(sheets, collection) {
  const spreadsheetId = getSpreadsheetId();
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const existing = meta.data.sheets.find((s) => s.properties.title === collection.sheetName);

  let sheetId;
  if (!existing) {
    const addRes = await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [{ addSheet: { properties: { title: collection.sheetName } } }],
      },
    });
    sheetId = addRes.data.replies[0].addSheet.properties.sheetId;
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${collection.sheetName}!A1`,
      valueInputOption: "RAW",
      requestBody: { values: [HEADER] },
    });
  } else {
    sheetId = existing.properties.sheetId;
    // Make sure header row is present/correct even if the tab already existed.
    const headerRes = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${collection.sheetName}!A1:${LAST_COL}1`,
    });
    const currentHeader = headerRes.data.values ? headerRes.data.values[0] : [];
    if (currentHeader.join("|") !== HEADER.join("|")) {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${collection.sheetName}!A1`,
        valueInputOption: "RAW",
        requestBody: { values: [HEADER] },
      });
    }
  }

  // This whole tab is the raw database the app reads/writes directly —
  // not meant for people to look at. Hide the entire tab (not just some
  // columns). Ignore failures (e.g. already hidden) — cosmetic only.
  try {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            updateSheetProperties: {
              properties: { sheetId, hidden: true },
              fields: "hidden",
            },
          },
        ],
      },
    });
  } catch {
    // non-fatal
  }

  return sheetId;
}

// Ensures a collection's Overview tab exists — a human-friendly,
// read-only-by-convention summary, safe for people to actually look at
// (no ids/lat/lng/internal fields). Safe to call repeatedly.
async function ensureOverviewSheet(sheets, collection) {
  const spreadsheetId = getSpreadsheetId();
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  let existing = meta.data.sheets.find(
    (s) => s.properties.title === collection.overviewSheetName
  );

  // One-time migration: a tab left over from before this collection's
  // Overview name changed (possibly more than once — legacyOverviewSheetNames
  // is checked in order, so any prior name in the chain still gets found).
  // Rename it in place (keeping its formatting, gid, and any manual
  // tweaks) rather than creating a fresh blank tab and leaving the old
  // one orphaned.
  if (!existing && collection.legacyOverviewSheetNames?.length) {
    const legacy = meta.data.sheets.find((s) =>
      collection.legacyOverviewSheetNames.includes(s.properties.title)
    );
    if (legacy) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [
            {
              updateSheetProperties: {
                properties: {
                  sheetId: legacy.properties.sheetId,
                  title: collection.overviewSheetName,
                },
                fields: "title",
              },
            },
          ],
        },
      });
      existing = legacy;
    }
  }

  let sheetId;
  if (!existing) {
    const addRes = await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            addSheet: {
              properties: {
                title: collection.overviewSheetName,
                gridProperties: { frozenRowCount: 1 },
              },
            },
          },
        ],
      },
    });
    sheetId = addRes.data.replies[0].addSheet.properties.sheetId;
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${collection.overviewSheetName}!A1`,
      valueInputOption: "RAW",
      requestBody: { values: [OVERVIEW_HEADER] },
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
    sheetId = existing.properties.sheetId;
    const headerRes = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${collection.overviewSheetName}!A1:${OVERVIEW_LAST_COL}1`,
    });
    const currentHeader = headerRes.data.values ? headerRes.data.values[0] : [];
    if (currentHeader.join("|") !== OVERVIEW_HEADER.join("|")) {
      // Clear a wide range first in case the header shrank (fewer/renamed
      // columns) — otherwise a stale trailing column's old header/data
      // would be left behind past OVERVIEW_LAST_COL.
      await sheets.spreadsheets.values.clear({
        spreadsheetId,
        range: `${collection.overviewSheetName}!A1:Z`,
      });
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${collection.overviewSheetName}!A1`,
        valueInputOption: "RAW",
        requestBody: { values: [OVERVIEW_HEADER] },
      });
    }
  }

  return sheetId;
}

function statusLabelFor(item) {
  return item.status === "archived"
    ? `Archived${item.archiveReason ? ` (${item.archiveReason})` : ""}`
    : "Active";
}

// Groups items the same way the site does (shared groupUnits — see its
// comment), so the Overview tab has one row per thing-you'd-actually-book,
// not one row per individual item. Adds the `rank` each row sorts/displays
// by, since groupUnits itself doesn't know about rank.
function groupForOverview(items) {
  const sorted = [...items].sort((a, b) => (a.rank ?? 999999) - (b.rank ?? 999999));
  return groupUnits(sorted).map((unit) => ({
    ...unit,
    rank: Math.min(...unit.listings.map((l) => l.rank ?? 999999)),
  }));
}

// One clickable cell whose visible text is every property's title,
// stacked with line breaks, linking back to the site (the shared
// section anchor for a paired unit, or the single item's own anchor
// otherwise).
function propertyCellValue(collection, unit) {
  const anchorId =
    unit.listings.length > 1 ? `group-${unit.listings[0].id}` : `listing-${unit.listings[0].id}`;
  const url = siteAnchorUrl(collection, anchorId).replace(/"/g, '""');
  const label = unit.listings
    .map((l) => l.title || "")
    .join("\n")
    .replace(/"/g, '""');
  if (!label) return "";
  return `=HYPERLINK("${url}", "${label}")`;
}

function overviewRowForUnit(collection, unit) {
  return [
    unit.rank >= 999999 ? "" : unit.rank,
    propertyCellValue(collection, unit),
    unit.listings.map((l) => l.price || "").join("\n"),
    unit.listings
      .map((l) => {
        const avg = extractAvgPerNight(l.price);
        return avg == null ? "" : Math.round(avg);
      })
      .join("\n"),
    unit.listings.map((l) => l.bedrooms ?? "").join("\n"),
    unit.listings.map((l) => l.beds ?? "").join("\n"),
    unit.listings.map((l) => l.bathrooms ?? "").join("\n"),
    unit.listings.map(statusLabelFor).join("\n"),
    unit.listings.map((l) => l.description || "").join("\n---\n"),
    unit.listings.map((l) => l.concerns || "").join("\n---\n"),
    unit.listings.map((l) => l.notes || "").join("\n---\n"),
  ];
}

// Rewrites a collection's Overview tab data rows from the given items
// (already fetched — callers pass what they have so this never triggers
// an extra read). Best-effort: never throws, so a hiccup here can't
// break a real CRUD operation.
async function syncOverviewSheet(sheets, collection, items) {
  try {
    const spreadsheetId = getSpreadsheetId();
    const sheetId = await ensureOverviewSheet(sheets, collection);
    const units = groupForOverview(items);
    const rows = units.map((u) => overviewRowForUnit(collection, u));

    // Clear old data rows (values only — keeps any formatting in place),
    // then write the fresh set.
    await sheets.spreadsheets.values.clear({
      spreadsheetId,
      range: `${collection.overviewSheetName}!A2:${OVERVIEW_LAST_COL}`,
    });
    if (rows.length > 0) {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${collection.overviewSheetName}!A2`,
        valueInputOption: "USER_ENTERED",
        requestBody: { values: rows },
      });
    }
    return sheetId;
  } catch {
    // non-fatal — the app's own data (the raw tab) is unaffected.
    return null;
  }
}

// Returns the Overview tab's URL. When `items` is passed (the GET route
// already has the full current list in hand), this also rewrites the
// Overview tab's data rows first — so every page load keeps Overview in
// sync with the raw sheet, and self-heals if someone deleted the Overview
// tab entirely, rather than only fixing that on the next add/edit/delete.
export async function getOverviewSheetUrl(collection, items) {
  try {
    const sheets = await getSheetsClient();
    const spreadsheetId = getSpreadsheetId();
    const sheetId = items
      ? await syncOverviewSheet(sheets, collection, items)
      : await ensureOverviewSheet(sheets, collection);
    if (sheetId == null) {
      return `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;
    }
    return `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit#gid=${sheetId}`;
  } catch {
    return `https://docs.google.com/spreadsheets/d/${getSpreadsheetId()}/edit`;
  }
}

async function getSheetTabId(sheets, collection) {
  const spreadsheetId = getSpreadsheetId();
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const tab = meta.data.sheets.find((s) => s.properties.title === collection.sheetName);
  return tab ? tab.properties.sheetId : null;
}

function rowToItem(row) {
  const obj = {};
  HEADER.forEach((key, i) => {
    obj[key] = row[i] ?? "";
  });
  obj.rank = obj.rank === "" ? null : Number(obj.rank);
  obj.lat = obj.lat === "" ? null : Number(obj.lat);
  obj.lng = obj.lng === "" ? null : Number(obj.lng);
  obj.bedrooms = obj.bedrooms === "" ? "" : Number(obj.bedrooms);
  obj.beds = obj.beds === "" ? "" : Number(obj.beds);
  obj.bathrooms = obj.bathrooms === "" ? "" : Number(obj.bathrooms);
  return obj;
}

function titleCellValue(item) {
  // Make the title a clickable link back to the item's anchor on the
  // site, rather than plain text, so the sheet doubles as a jump-off point.
  if (!item.siteLink) return item.title || "";
  const safeTitle = String(item.title || "").replace(/"/g, '""');
  const safeUrl = String(item.siteLink).replace(/"/g, '""');
  return `=HYPERLINK("${safeUrl}", "${safeTitle}")`;
}

function itemToRow(item) {
  return HEADER.map((key) => {
    if (key === "title") return titleCellValue(item);
    const v = item[key];
    return v === null || v === undefined ? "" : v;
  });
}

// Returns every item in a collection plus its 1-based sheet row number
// (row 1 is the header, so data starts at row 2).
export async function getAllItems(collection) {
  const sheets = await getSheetsClient();
  await ensureSheet(sheets, collection);
  const spreadsheetId = getSpreadsheetId();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${collection.sheetName}!A2:${LAST_COL}`,
  });
  const rows = res.data.values || [];
  return rows.map((row, i) => ({ ...rowToItem(row), _row: i + 2 }));
}

export async function findItemByUrl(collection, normalizedUrl) {
  const all = await getAllItems(collection);
  return all.find((l) => l.url === normalizedUrl) || null;
}

// Note: this deliberately does NOT use sheets.spreadsheets.values.append().
// The Sheets API's "find the table, then append after it" heuristic is
// unreliable when the sheet has few rows (observed firsthand: with only
// a header row present, append() decided there was no real "table" and
// inserted the new row AT row 1, shoving the header down into row 2
// instead of writing the new item there). Writing to an explicitly
// computed row number sidesteps that heuristic entirely.
export async function appendItem(collection, item) {
  const sheets = await getSheetsClient();
  await ensureSheet(sheets, collection);
  const spreadsheetId = getSpreadsheetId();
  const all = await getAllItems(collection);
  const nextRow = all.length > 0 ? Math.max(...all.map((l) => l._row)) + 1 : 2;
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${collection.sheetName}!A${nextRow}:${LAST_COL}${nextRow}`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [itemToRow(item)] },
  });
  const refreshed = await getAllItems(collection);
  await syncOverviewSheet(sheets, collection, refreshed);
}

export async function updateItemByRow(collection, rowNumber, patch) {
  const sheets = await getSheetsClient();
  const spreadsheetId = getSpreadsheetId();
  const all = await getAllItems(collection);
  const existing = all.find((l) => l._row === rowNumber);
  if (!existing) throw new Error("Row not found");
  const merged = { ...existing, ...patch };
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${collection.sheetName}!A${rowNumber}:${LAST_COL}${rowNumber}`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [itemToRow(merged)] },
  });
  const refreshed = all.map((l) => (l._row === rowNumber ? merged : l));
  await syncOverviewSheet(sheets, collection, refreshed);
  return merged;
}

export async function deleteItemByRow(collection, rowNumber) {
  const sheets = await getSheetsClient();
  const spreadsheetId = getSpreadsheetId();
  const sheetId = await getSheetTabId(sheets, collection);
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          deleteDimension: {
            range: {
              sheetId,
              dimension: "ROWS",
              startIndex: rowNumber - 1, // 0-based, inclusive
              endIndex: rowNumber, // exclusive
            },
          },
        },
      ],
    },
  });
  const remaining = await getAllItems(collection);
  await syncOverviewSheet(sheets, collection, remaining);
}
