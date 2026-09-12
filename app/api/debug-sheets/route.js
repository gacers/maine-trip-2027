import { NextResponse } from "next/server";
import { google } from "googleapis";

// Temporary: verify the Avg/Night column got currency formatting.
// Remove after use.
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
  const res = await sheets.spreadsheets.get({
    spreadsheetId,
    ranges: ["Possible Properties!D1:D3"],
    fields: "sheets.data.rowData.values(formattedValue,userEnteredFormat.numberFormat)",
  });
  return NextResponse.json(res.data.sheets[0].data[0].rowData);
}
