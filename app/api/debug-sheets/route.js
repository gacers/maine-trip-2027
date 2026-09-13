import { NextResponse } from "next/server";
import { google } from "googleapis";
import { COLLECTION_LIST } from "@/lib/collections";

// Temporary: one-off reset of leftover row background tint (from a
// since-reverted feature) back to no-fill on every Overview tab. Remove
// after use.
export async function GET() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = (process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || "").replace(/\\n/g, "\n");
  const auth = new google.auth.JWT({
    email,
    key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  await auth.authorize();
  const sheets = google.sheets({ version: "v4", auth });
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;
  const meta = await sheets.spreadsheets.get({ spreadsheetId });

  const overviewNames = new Set(COLLECTION_LIST.map((c) => c.overviewSheetName));
  const overviewSheets = meta.data.sheets.filter((s) => overviewNames.has(s.properties.title));

  const requests = overviewSheets.map((s) => ({
    repeatCell: {
      range: { sheetId: s.properties.sheetId, startRowIndex: 0, endRowIndex: 1000 },
      cell: { userEnteredFormat: { backgroundColor: { red: 1, green: 1, blue: 1 } } },
      fields: "userEnteredFormat.backgroundColor",
    },
  }));

  await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests } });

  return NextResponse.json({ resetSheets: overviewSheets.map((s) => s.properties.title) });
}
