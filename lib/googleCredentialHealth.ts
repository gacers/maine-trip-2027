import { google } from "googleapis";
import { getSheetsClient } from "@/lib/googleSheetsAuth";
import { getOAuthClient } from "@/lib/drive";

export type GoogleCredentialKey = "sheets" | "drive" | "maps";

export interface GoogleCredentialStatus {
  key: GoogleCredentialKey;
  label: string;
  ok: boolean;
  message: string;
  checkedAt: string;
}

// Deliberately doesn't touch any specific spreadsheet/file — a stale
// or deleted id would fail this for a reason that has nothing to do
// with whether the credential itself still works. getSheetsClient's
// own auth.authorize() already makes a real call to Google's token
// endpoint to mint an access token from the service account's JWT,
// which is exactly the thing that fails the moment that key gets
// revoked/disabled — that's the whole check.
async function checkSheetsCredential(): Promise<GoogleCredentialStatus> {
  const checkedAt = new Date().toISOString();
  try {
    await getSheetsClient();
    return { key: "sheets", label: "Sheets / Docs (service account)", ok: true, message: "Working", checkedAt };
  } catch (err) {
    return {
      key: "sheets",
      label: "Sheets / Docs (service account)",
      ok: false,
      message: (err as Error).message || "Service account auth failed",
      checkedAt,
    };
  }
}

// Same idea for the Drive OAuth grant — about.get needs no file id at
// all, just a valid access token, which google.auth.OAuth2 mints from
// the stored refresh token the moment this call is made.
async function checkDriveCredential(): Promise<GoogleCredentialStatus> {
  const checkedAt = new Date().toISOString();
  try {
    const oauth = getOAuthClient();
    const drive = google.drive({ version: "v3", auth: oauth });
    await drive.about.get({ fields: "user" });
    return { key: "drive", label: "Drive (OAuth)", ok: true, message: "Working", checkedAt };
  } catch (err) {
    return {
      key: "drive",
      label: "Drive (OAuth)",
      ok: false,
      message: (err as Error).message || "OAuth refresh token failed",
      checkedAt,
    };
  }
}

// A single, cheap Geocoding call — same REST shape lib/geocodeCache.ts
// already uses server-side — checking the response's own `status`
// field, since Google's Geocoding API returns 200 OK even for a
// revoked/restricted key, with the real failure reason only inside the
// JSON body (REQUEST_DENIED, INVALID_REQUEST, ...).
async function checkMapsCredential(): Promise<GoogleCredentialStatus> {
  const checkedAt = new Date().toISOString();
  const apiKey = process.env.GOOGLE_MAPS_SERVER_API_KEY;
  if (!apiKey) {
    return { key: "maps", label: "Maps / Places (API key)", ok: false, message: "GOOGLE_MAPS_SERVER_API_KEY is not set", checkedAt };
  }
  try {
    const qs = new URLSearchParams({ address: "1600 Amphitheatre Parkway, Mountain View, CA", key: apiKey });
    const res = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?${qs}`);
    const data = (await res.json()) as { status: string; error_message?: string };
    if (data.status === "OK") {
      return { key: "maps", label: "Maps / Places (API key)", ok: true, message: "Working", checkedAt };
    }
    return {
      key: "maps",
      label: "Maps / Places (API key)",
      ok: false,
      message: data.error_message || data.status || "Geocoding request failed",
      checkedAt,
    };
  } catch (err) {
    return { key: "maps", label: "Maps / Places (API key)", ok: false, message: (err as Error).message, checkedAt };
  }
}

// All three, run together — each is independent of the others, so no
// reason to wait on them one at a time.
export async function checkAllGoogleCredentials(): Promise<GoogleCredentialStatus[]> {
  return Promise.all([checkSheetsCredential(), checkDriveCredential(), checkMapsCredential()]);
}
