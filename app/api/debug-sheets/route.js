import { NextResponse } from "next/server";
import { google } from "googleapis";

// Temporary: verify the Overview header migration (Beds/Baths split) and
// the Possible Houses clear-out actually took effect. Remove after use.
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
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: "Possible Properties!A1:J",
  });
  return NextResponse.json({ values: res.data.values || [] });
}
