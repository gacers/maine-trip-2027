import { google } from "googleapis";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Trip } from "@/lib/types";

// Plain service accounts have zero Google Drive storage quota, so they
// can't own a file even inside a folder shared with them as Editor —
// confirmed by hand (a real "storage quota exceeded" error) before
// building this. The fix: a one-time OAuth authorization of a real
// Google account (GOOGLE_OAUTH_REFRESH_TOKEN) does the actual file
// creation — that account has real quota — then shares it with the
// service account, which does every read/write after that via the
// normal Sheets API (see lib/googleSheetsAuth.ts).
export function getOAuthClient() {
  const client = new google.auth.OAuth2(process.env.GOOGLE_OAUTH_CLIENT_ID, process.env.GOOGLE_OAUTH_CLIENT_SECRET);
  client.setCredentials({ refresh_token: process.env.GOOGLE_OAUTH_REFRESH_TOKEN });
  return client;
}

export interface CreatedDriveFile {
  id: string;
  url: string;
}

// Creates a new Google Sheet named `name` inside `folderId` (or the
// user's My Drive root if not given), shares it with the service
// account as an editor, and makes it link-shareable (anyone with the
// link can view) — that's the actual point of exporting to a
// spreadsheet, so friends can open it without individual Google
// accounts. Returns { id, url }.
export async function createSheetInDrive(name: string, folderId?: string | null): Promise<CreatedDriveFile> {
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

// Same idea as createSheetInDrive, for a Google Doc instead (the
// itinerary export) — same reason it has to go through the OAuth
// account rather than the service account (no Drive quota to own a
// file with), same create-then-share-with-the-service-account-then-
// make-link-shareable shape, just a different mimeType/URL template.
export async function createDocInDrive(name: string, folderId?: string | null): Promise<CreatedDriveFile> {
  const oauth = getOAuthClient();
  const drive = google.drive({ version: "v3", auth: oauth });

  const { data } = await drive.files.create({
    requestBody: {
      name,
      mimeType: "application/vnd.google-apps.document",
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

  return { id: data.id!, url: `https://docs.google.com/document/d/${data.id}/edit` };
}

// Groups a trip's own Sheet + itinerary Doc together in one subfolder
// (inside the app-wide shared folder, app_settings.google_drive_folder_id)
// instead of every trip's files sitting flat as siblings — created
// lazily, the first time either export needs a folder for a trip that
// doesn't have one yet (see createSheetInDrive/createDocInDrive's own
// callers). Any of the trip's files that already existed before it had
// its own folder (a Sheet exported under the old flat layout, or an
// itinerary Doc that happened to get created first) get moved into the
// new folder too, right here, so nothing's left stranded behind.
export async function getOrCreateTripFolder(supabase: SupabaseClient, trip: Trip): Promise<string | null> {
  if (trip.google_drive_folder_id) return trip.google_drive_folder_id;

  const { data: settings } = await supabase
    .from("app_settings")
    .select("google_drive_folder_id")
    .eq("id", true)
    .maybeSingle();
  const parentFolderId: string | undefined = settings?.google_drive_folder_id || undefined;

  const oauth = getOAuthClient();
  const drive = google.drive({ version: "v3", auth: oauth });

  const { data } = await drive.files.create({
    requestBody: {
      name: trip.name,
      mimeType: "application/vnd.google-apps.folder",
      parents: parentFolderId ? [parentFolderId] : undefined,
    },
    fields: "id",
  });
  const folderId = data.id!;

  await supabase.from("trips").update({ google_drive_folder_id: folderId }).eq("id", trip.id);

  // Best-effort — a stranded pre-existing file staying where it is
  // isn't worth failing the whole export over.
  for (const fileId of [trip.google_sheet_id, trip.google_itinerary_doc_id]) {
    if (!fileId) continue;
    await drive.files
      .update({ fileId, addParents: folderId, removeParents: parentFolderId || "root", fields: "id, parents" })
      .catch(() => {});
  }

  return folderId;
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
