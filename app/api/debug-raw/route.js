import { NextResponse } from "next/server";
import { google } from "googleapis";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function getAuth() {
  const b64 = process.env.GOOGLE_SERVICE_ACCOUNT_JSON_B64;
  const parsed = JSON.parse(Buffer.from(b64, "base64").toString("utf8"));
  return new google.auth.JWT({
    email: parsed.client_email,
    key: parsed.private_key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
}

export async function GET() {
  try {
    const auth = getAuth();
    await auth.authorize();
    const sheets = google.sheets({ version: "v4", auth });
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;
    const raw = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: "Listings!A1:P5",
      valueRenderOption: "FORMULA",
    });
    const meta = await sheets.spreadsheets.get({ spreadsheetId });
    return NextResponse.json({
      raw: raw.data.values,
      sheets: meta.data.sheets.map((s) => ({
        title: s.properties.title,
        sheetId: s.properties.sheetId,
        index: s.properties.index,
        hidden: s.properties.hidden || false,
        rowCount: s.properties.gridProperties?.rowCount,
        colCount: s.properties.gridProperties?.columnCount,
      })),
    });
  } catch (err) {
    return NextResponse.json({ error: err.message, stack: err.stack }, { status: 500 });
  }
}
