import { google, sheets_v4 } from "googleapis";

// The service account used for all actual Sheets read/write (values.*)
// once a trip's export Sheet has been created + shared with it — see
// lib/drive.ts for how that sharing happens (a plain service account
// can't create/own the file itself).
export async function getSheetsClient(): Promise<sheets_v4.Sheets> {
  const auth = new google.auth.JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: (process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  await auth.authorize();
  return google.sheets({ version: "v4", auth });
}
