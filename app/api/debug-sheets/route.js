import { NextResponse } from "next/server";
import { google } from "googleapis";

// Temporary: inspect live tab state (titles/hidden/gid) to verify the
// Overview rename + hidden-Listings-tab fix actually took effect.
// Remove after use.
export async function GET() {
  const b64 = process.env.GOOGLE_SERVICE_ACCOUNT_JSON_B64;
  const auth = b64
    ? new google.auth.JWT({
        email: JSON.parse(Buffer.from(b64, "base64").toString("utf8")).client_email,
        key: JSON.parse(Buffer.from(b64, "base64").toString("utf8")).private_key,
        scopes: ["https://www.googleapis.com/auth/spreadsheets"],
      })
    : new google.auth.JWT({
        email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        key: (process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
        scopes: ["https://www.googleapis.com/auth/spreadsheets"],
      });
  await auth.authorize();
  const sheets = google.sheets({ version: "v4", auth });
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const tabs = meta.data.sheets.map((s) => ({
    title: s.properties.title,
    sheetId: s.properties.sheetId,
    hidden: !!s.properties.hidden,
    index: s.properties.index,
  }));
  return NextResponse.json({ tabs });
}
