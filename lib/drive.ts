import { google } from "googleapis";

// Plain service accounts have zero Google Drive storage quota, so they
// can't own a file even inside a folder shared with them as Editor —
// confirmed by hand (a real "storage quota exceeded" error) before
// building this. The fix: a one-time OAuth authorization of a real
// Google account (GOOGLE_OAUTH_REFRESH_TOKEN) does the actual file
// creation — that account has real quota — then shares it with the
// service account, which does every read/write after that via the
// normal Sheets API (see lib/googleSheetsAuth.ts).
function getOAuthClient() {
  const client = new google.auth.OAuth2(process.env.GOOGLE_OAUTH_CLIENT_ID, process.env.GOOGLE_OAUTH_CLIENT_SECRET);
  client.setCredentials({ refresh_token: process.env.GOOGLE_OAUTH_REFRESH_TOKEN });
  return client;
}

export interface CreatedSheet {
  id: string;
  url: string;
}

// Creates a new Google Sheet named `name` inside `folderId` (or the
// user's My Drive root if not given), shares it with the service
// account as an editor, and makes it link-shareable (anyone with the
// link can view) — that's the actual point of exporting to a
// spreadsheet, so friends can open it without individual Google
// accounts. Returns { id, url }.
export async function createSheetInDrive(name: string, folderId?: string | null): Promise<CreatedSheet> {
  const oauth = getOAuthClient();
  const drive = google.drive({ version: "v3", auth: oauth });

  const { data } = await drive.files.create({
    requestBody: {
      name,
      mimeType: "application/vnd.google-apps.spreadsheet",
      parents: folderId ? [folderId] : undefined,
    },
    fields: "id",
  });

  await drive.permissions.create({
    fileId: data.id!,
    requestBody: {
      type: "user",
      role: "writer",
      emailAddress: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    },
  });

  await drive.permissions.create({
    fileId: data.id!,
    requestBody: { type: "anyone", role: "reader" },
  });

  return { id: data.id!, url: `https://docs.google.com/spreadsheets/d/${data.id}/edit` };
}

// Grants one specific person real Google Sheets access by email —
// on top of the "anyone with the link can view" sharing every Sheet
// already gets above, this is for someone you want to actually edit
// cells directly (or just get their own real Google-account access
// instead of relying on the link), with Google's own email
// notification telling them it happened. Goes through the same OAuth
// account that owns the file (see getOAuthClient above) — the service
// account that does everyday reads/writes has no authority to grant
// other people access to a file it doesn't own.
export async function addSheetCollaborator(
  spreadsheetId: string,
  email: string,
  role: "reader" | "writer" = "writer"
): Promise<void> {
  const oauth = getOAuthClient();
  const drive = google.drive({ version: "v3", auth: oauth });
  await drive.permissions.create({
    fileId: spreadsheetId,
    sendNotificationEmail: true,
    requestBody: { type: "user", role, emailAddress: email },
  });
}
