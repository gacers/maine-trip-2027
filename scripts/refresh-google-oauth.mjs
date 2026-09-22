#!/usr/bin/env node
// One-time re-auth when GOOGLE_OAUTH_REFRESH_TOKEN starts returning
// invalid_grant (revoked password change, unused 6 months, or Google
// security reset). Opens a localhost callback, prints a fresh refresh
// token — paste it into .env.local and Vercel as
// GOOGLE_OAUTH_REFRESH_TOKEN, then restart the app.
//
// Usage: node --env-file=.env.local scripts/refresh-google-oauth.mjs

import http from "node:http";
import { google } from "googleapis";

const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
if (!clientId || !clientSecret) {
  console.error("Need GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET in env.");
  process.exit(1);
}

const PORT = 3927;
const redirectUri = `http://localhost:${PORT}/oauth2callback`;
// Same scopes Drive creation needs (create Sheet/Doc, share, folders).
const SCOPES = ["https://www.googleapis.com/auth/drive"];

const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
const authUrl = oauth2Client.generateAuthUrl({
  access_type: "offline",
  prompt: "consent", // force a refresh_token even if already consented
  scope: SCOPES,
});

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    if (url.pathname !== "/oauth2callback") {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    const code = url.searchParams.get("code");
    const err = url.searchParams.get("error");
    if (err || !code) {
      res.writeHead(400);
      res.end(`Auth failed: ${err || "missing code"}`);
      console.error("Auth failed:", err || "missing code");
      server.close();
      process.exit(1);
    }

    const { tokens } = await oauth2Client.getToken(code);
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end("<p>Got it — you can close this tab and go back to the terminal.</p>");

    if (!tokens.refresh_token) {
      console.error(
        "No refresh_token in the response. Revoke access at https://myaccount.google.com/permissions then run this again."
      );
      server.close();
      process.exit(1);
    }

    console.log("\nNew GOOGLE_OAUTH_REFRESH_TOKEN (paste into .env.local and Vercel):\n");
    console.log(tokens.refresh_token);
    console.log("\nThen restart `next dev` / redeploy so the new value is loaded.\n");
    server.close();
    process.exit(0);
  } catch (e) {
    console.error(e);
    res.writeHead(500);
    res.end(String(e));
    server.close();
    process.exit(1);
  }
});

server.listen(PORT, () => {
  console.log("Authorize Drive file creation with the Google account that owns the trip Sheets folder:\n");
  console.log(authUrl);
  console.log(`\nWaiting on ${redirectUri} …`);
  console.log(
    "(If Google rejects the redirect URI, add it under the OAuth client's Authorized redirect URIs in Google Cloud Console.)"
  );
});
