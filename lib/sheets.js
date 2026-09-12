import { google } from "googleapis";

const SHEET_NAME = "Listings";
const HEADER = [
  "id",
  "rank",
  "title",
  "price",
  "url",
  "posterImage",
  "status",
  "archiveReason",
  "lat",
  "lng",
  "notes",
  "createdAt",
  "siteLink",
];

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

// Ensures the "Listings" tab exists with the expected header row. Safe to call repeatedly.
async function ensureSheet(sheets) {
  const spreadsheetId = getSpreadsheetId();
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const existing = meta.data.sheets.find((s) => s.properties.title === SHEET_NAME);

  if (!existing) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [{ addSheet: { properties: { title: SHEET_NAME } } }],
      },
    });
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${SHEET_NAME}!A1`,
      valueInputOption: "RAW",
      requestBody: { values: [HEADER] },
    });
    return await getSheetTabId(sheets);
  }

  // Make sure header row is present/correct even if the tab already existed empty.
  const headerRes = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${SHEET_NAME}!A1:M1`,
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

  return existing.properties.sheetId;
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

function listingToRow(listing) {
  return HEADER.map((key) => {
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
    range: `${SHEET_NAME}!A2:M`,
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
    range: `${SHEET_NAME}!A${rowNumber}:M${rowNumber}`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [listingToRow(merged)] },
  });
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
}
