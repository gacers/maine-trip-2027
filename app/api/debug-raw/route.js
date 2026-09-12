import { NextResponse } from "next/server";
import { google } from "googleapis";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function getAuth() {
  const b64 = process.env.GOOGLE_SERVICE_ACCOUNT_JSON_B64;
  if (b64) {
    const parsed = JSON.parse(Buffer.from(b64, "base64").toString("utf8"));
    return new google.auth.JWT({
      email: parsed.client_email,
      key: parsed.private_key,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });
  }
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY.replace(/\\n/g, "\n");
  return new google.auth.JWT({ email, key, scopes: ["https://www.googleapis.com/auth/spreadsheets"] });
}

export async function GET() {
  try {
    const auth = getAuth();
    await auth.authorize();
    const sheets = google.sheets({ version: "v4", auth });
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;

    // Clear rows 2+ first so we get a clean test.
    await sheets.spreadsheets.values.clear({ spreadsheetId, range: "Listings!A2:P" });

    const testRow = [
      "TESTID","7","TESTTITLE","TESTPRICE","TESTURL","TESTIMG","TESTDESC",
      "active","","44.1","-68.1","","TESTNOTES","2026-01-01T00:00:00.000Z","TESTLINK","",
    ];
    const appendRes = await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: "Listings!A1",
      valueInputOption: "USER_ENTERED",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: [testRow] },
    });

    const raw = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: "Listings!A1:P5",
      valueRenderOption: "FORMULA",
    });

    return NextResponse.json({
      appendUpdatedRange: appendRes.data.updates?.updatedRange,
      appendUpdatedRows: appendRes.data.updates?.updatedRows,
      rawAfter: raw.data.values,
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
