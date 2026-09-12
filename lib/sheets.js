import { google } from "googleapis";

const SHEET_NAME = "Listings";
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
];
const LAST_COL = "P"; // must match HEADER.length (16 columns, A..P)

const OVERVIEW_SHEET_NAME = "Overview";
const OVERVIEW_HEADER = ["Rank", "Group", "Title", "Price", "Status", "Description", "Notes"];
const OVERVIEW_LAST_COL = "G";

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

export function siteLinkFor(id) {
  const base =
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
  return `${base.replace(/\/$/, "")}/#listing-${id}`;
}

// Ensures the "Listings" tab exists with the expected header row, and that
// column A (id) is hidden — it's needed internally but isn't useful to look
// at in the sheet. Safe to call repeatedly.
async function ensureSheet(sheets) {
  const spreadsheetId = getSpreadsheetId();
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const existing = meta.data.sheets.find((s) => s.properties.title === SHEET_NAME);

  let sheetId;
  if (!existing) {
    const addRes = await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [{ addSheet: { properties: { title: SHEET_NAME } } }],
      },
    });
    sheetId = addRes.data.replies[0].addSheet.properties.sheetId;
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${SHEET_NAME}!A1`,
      valueInputOption: "RAW",
      requestBody: { values: [HEADER] },
    });
  } else {
    sheetId = existing.properties.sheetId;
    // Make sure header row is present/correct even if the tab already existed.
    const headerRes = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${SHEET_NAME}!A1:${LAST_COL}1`,
    });
    const currentHeader = headerRes.data.values ? headerRes.data.values[0] : [];
    if (currentHeader.join("|") !== HEADER.join("|")) {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${SHEET_NAME}!A1`,
        valueInputOption: "RAW",
        requestBody: { values: [HEADER] },
      });
    }
  }

  // This whole tab is the raw database the app reads/writes directly —
  // not meant for people to look at. Hide the entire tab (not just some
  // columns); the "Overview" tab is the human-friendly one. Ignore
  // failures (e.g. already hidden) — cosmetic only.
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

// Ensures the "Overview" tab exists — a human-friendly, read-only-by-
// convention summary of the listings, safe for people to actually look
// at (no ids/lat/lng/internal fields). Safe to call repeatedly.
async function ensureOverviewSheet(sheets) {
  const spreadsheetId = getSpreadsheetId();
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const existing = meta.data.sheets.find((s) => s.properties.title === OVERVIEW_SHEET_NAME);

  let sheetId;
  if (!existing) {
    const addRes = await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            addSheet: {
              properties: {
                title: OVERVIEW_SHEET_NAME,
                gridProperties: { frozenRowCount: 1 },
                index: 0,
              },
            },
          },
        ],
      },
    });
    sheetId = addRes.data.replies[0].addSheet.properties.sheetId;
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${OVERVIEW_SHEET_NAME}!A1`,
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
      range: `${OVERVIEW_SHEET_NAME}!A1:${OVERVIEW_LAST_COL}1`,
    });
    const currentHeader = headerRes.data.values ? headerRes.data.values[0] : [];
    if (currentHeader.join("|") !== OVERVIEW_HEADER.join("|")) {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${OVERVIEW_SHEET_NAME}!A1`,
        valueInputOption: "RAW",
        requestBody: { values: [OVERVIEW_HEADER] },
      });
    }
  }

  return sheetId;
}

function overviewRow(listing) {
  const statusLabel =
    listing.status === "archived"
      ? `Archived${listing.archiveReason ? ` (${listing.archiveReason.split(",").join(", ")})` : ""}`
      : "Active";
  return [
    listing.rank ?? "",
    listing.groupLabel || "",
    titleCellValue(listing),
    listing.price || "",
    statusLabel,
    listing.description || "",
    listing.notes || "",
  ];
}

// Rewrites the Overview tab's data rows from the given listings (already
// fetched — callers pass what they have so this never triggers an extra
// read). Best-effort: never throws, so a hiccup here can't break a real
// CRUD operation.
async function syncOverviewSheet(sheets, listings) {
  try {
    const spreadsheetId = getSpreadsheetId();
    const sheetId = await ensureOverviewSheet(sheets);
    const sorted = [...listings].sort((a, b) => (a.rank ?? 999999) - (b.rank ?? 999999));
    const rows = sorted.map(overviewRow);

    // Clear old data rows (values only — keeps any formatting in place),
    // then write the fresh set.
    await sheets.spreadsheets.values.clear({
      spreadsheetId,
      range: `${OVERVIEW_SHEET_NAME}!A2:${OVERVIEW_LAST_COL}`,
    });
    if (rows.length > 0) {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${OVERVIEW_SHEET_NAME}!A2`,
        valueInputOption: "USER_ENTERED",
        requestBody: { values: rows },
      });
    }
    return sheetId;
  } catch {
    // non-fatal — the app's own data (the Listings tab) is unaffected.
    return null;
  }
}

export async function getOverviewSheetUrl() {
  try {
    const sheets = await getSheetsClient();
    const spreadsheetId = getSpreadsheetId();
    const sheetId = await ensureOverviewSheet(sheets);
    return `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit#gid=${sheetId}`;
  } catch {
    return `https://docs.google.com/spreadsheets/d/${getSpreadsheetId()}/edit`;
  }
}

async function getSheetTabId(sheets) {
  const spreadsheetId = getSpreadsheetId();
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const tab = meta.data.sheets.find((s) => s.properties.title === SHEET_NAME);
  return tab ? tab.properties.sheetId : null;
}

function rowToListing(row) {
  const obj = {};
  HEADER.forEach((key, i) => {
    obj[key] = row[i] ?? "";
  });
  obj.rank = obj.rank === "" ? null : Number(obj.rank);
  obj.lat = obj.lat === "" ? null : Number(obj.lat);
  obj.lng = obj.lng === "" ? null : Number(obj.lng);
  return obj;
}

function titleCellValue(listing) {
  // Make the title a clickable link back to the listing's anchor on the
  // site, rather than plain text, so the sheet doubles as a jump-off point.
  if (!listing.siteLink) return listing.title || "";
  const safeTitle = String(listing.title || "").replace(/"/g, '""');
  const safeUrl = String(listing.siteLink).replace(/"/g, '""');
  return `=HYPERLINK("${safeUrl}", "${safeTitle}")`;
}

function listingToRow(listing) {
  return HEADER.map((key) => {
    if (key === "title") return titleCellValue(listing);
    const v = listing[key];
    return v === null || v === undefined ? "" : v;
  });
}

// Returns every listing plus its 1-based sheet row number (row 1 is the header, so data starts at row 2).
export async function getAllListings() {
  const sheets = await getSheetsClient();
  await ensureSheet(sheets);
  const spreadsheetId = getSpreadsheetId();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${SHEET_NAME}!A2:${LAST_COL}`,
  });
  const rows = res.data.values || [];
  return rows.map((row, i) => ({ ...rowToListing(row), _row: i + 2 }));
}

export async function findListingByUrl(normalizedUrl) {
  const all = await getAllListings();
  return all.find((l) => l.url === normalizedUrl) || null;
}

export async function appendListing(listing) {
  const sheets = await getSheetsClient();
  await ensureSheet(sheets);
  const spreadsheetId = getSpreadsheetId();
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${SHEET_NAME}!A1`,
    valueInputOption: "USER_ENTERED",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: [listingToRow(listing)] },
  });
  const all = await getAllListings();
  await syncOverviewSheet(sheets, all);
}

export async function updateListingByRow(rowNumber, patch) {
  const sheets = await getSheetsClient();
  const spreadsheetId = getSpreadsheetId();
  const all = await getAllListings();
  const existing = all.find((l) => l._row === rowNumber);
  if (!existing) throw new Error("Row not found");
  const merged = { ...existing, ...patch };
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${SHEET_NAME}!A${rowNumber}:${LAST_COL}${rowNumber}`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [listingToRow(merged)] },
  });
  const refreshed = all.map((l) => (l._row === rowNumber ? merged : l));
  await syncOverviewSheet(sheets, refreshed);
  return merged;
}

export async function deleteListingByRow(rowNumber) {
  const sheets = await getSheetsClient();
  const spreadsheetId = getSpreadsheetId();
  const sheetId = await getSheetTabId(sheets);
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
  const remaining = await getAllListings();
  await syncOverviewSheet(sheets, remaining);
}
