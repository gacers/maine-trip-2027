import { google, docs_v1 } from "googleapis";

// Same shape as lib/googleSheetsAuth.ts's getSheetsClient — the
// service account used for all actual Docs read/write (documents.*)
// once the itinerary's export Doc has been created + shared with it
// (see lib/drive.ts's createDocInDrive for why that has to go through
// the OAuth account instead: a plain service account can't own the
// file itself).
export async function getDocsClient(): Promise<docs_v1.Docs> {
  const auth = new google.auth.JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: (process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
    scopes: ["https://www.googleapis.com/auth/documents"],
  });
  await auth.authorize();
  return google.docs({ version: "v1", auth });
}
