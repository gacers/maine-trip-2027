# Maine Coast Trip 2027

A small Next.js app for tracking Airbnb/house options for the July 2027
Maine coast group trip (8 people, ~4 dogs).

## Features

- Paste an Airbnb URL to add a listing. Best-effort auto-fills title,
  price, photo, and location; anything it can't find is left blank for
  manual entry (Airbnb can rate-limit or block automated fetches, so this
  is never guaranteed).
- Duplicate URLs are rejected.
- Numeric rank field per listing; list sorts by it.
- Checkboxes for "Too expensive" / "Bad location" archive a listing
  (collapsible Archived section) with Restore and permanent Delete.
- Every add, edit, archive, restore, and delete is written straight to a
  Google Sheet, which doubles as a plain, image-free record with a link
  back to each listing's anchor on the page.

## Data model

Google Sheets is the database — there's no separate DB. See
`lib/sheets.js` for the schema (one row per listing in a "Listings" tab).

## Environment variables

See `.env.example`. You need:

1. A Google Cloud service account with the Sheets API enabled.
2. A Google Sheet shared with that service account's email as an Editor.
3. Those two plus the sheet ID set as environment variables in Vercel
   (Project Settings → Environment Variables) — never committed.

## Deploy

Import this repo into Vercel as its own project. No build config needed.
