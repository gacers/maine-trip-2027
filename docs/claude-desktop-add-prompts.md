# "Add <Trip>: ..." prompts for Claude Desktop

Reference for the Claude Desktop Project custom instructions that let you type
a one-line message to add an item to this site, instead of using the web UI.
Already working today for houses (`Add Maine: <url>`); this generalizes the
same pattern to every collection, and to future trips.

## The pattern

```
Add <Trip>[ <Category>]: <url>
[<url2>]
[Notes: <free text>]
```

- **`<Trip>`** — the trip's short name (`Maine` today). One Project = one trip
  = one site, so this word never actually needs parsing; it's just the
  human-readable label you type. What matters is which *site* the category
  maps to (see the table below).
- **`<Category>`** (optional) — picks which of the 6 collections the item
  goes into. Omit it and it defaults to the trip's main "possible houses"
  list, matching how `Add Maine:` already works.
- **One or two URLs**, one per line. Two URLs = a paired 2-item option (e.g.
  two houses booked together) — both get added with the same `groupLabel` so
  the site renders them as one linked unit.
- **`Notes:`** (optional, last line) — free text applied to the `notes` field
  of every item just added.

## Category → collection → API mapping (Maine Trip 2027)

Site base URL: `https://maine-trip-2027.vercel.app`

| Trigger | Collection | `apiSlug` | Overview sheet |
|---|---|---|---|
| `Add Maine:` (no category) | Possible Houses | `listings` | Possible Properties |
| `Add Maine Stay:` | Previous Stays | `stayed` | Previous Properties |
| `Add Maine Food:` | Food & Drink | `food-drink` | Possible Food & Drinks |
| `Add Maine Visited:` | Previously Visited | `visited-food-drink` | Visited Food & Drink |
| `Add Maine Activity:` | Activities | `activities` | Possible Activities |
| `Add Maine Previous Activity:` | Previous Activities | `previous-activities` | Previous Activities |

## What Claude should actually do, per URL

1. `POST {site}/api/{apiSlug}/preview` with body `{"url": "<url>"}`.
   - If the response is `{"duplicate": true, "existing": {...}}`, don't add it
     again — tell the user it's already on the list (mention its title).
   - Otherwise the response is `{"duplicate": false, "scraped": {title,
     price, description, posterImage, lat, lng, ...}}`.
2. `POST {site}/api/{apiSlug}` with a JSON body built from the scraped
   fields, plus:
   - `notes`: the text after `Notes:`, if given (same text on every item in
     this message).
   - `groupLabel`: only when two URLs were given together (see below).
3. Report back what got added (title + which list), or any error.

### Deriving `groupLabel` for a paired (2-URL) add

The site groups two items into one card/map/rank whenever they share a
non-empty `groupLabel` — see `lib/groupUnits.js` in the repo. You're not told
a label explicitly, so derive one:
- If both scraped titles share an obvious common lead-in before a separator
  (e.g. `"Gouldsboro - Schoodic East"` / `"Gouldsboro - Harbor House"` share
  `"Gouldsboro"`), use that shared piece as the label.
- Otherwise, use the two titles' shared town/neighborhood if it appears in
  both descriptions, or fall back to asking the user for a short label
  before adding (better to ask once than to silently mis-group).
- Set the exact same `groupLabel` string on both items' POST bodies.

## Generalizing to a future trip

This whole site's code (`lib/collections.js`) already treats every
collection identically — new trips deployed from this same codebase will
have the same 6 `apiSlug`s (`listings`, `stayed`, `food-drink`,
`visited-food-drink`, `activities`, `previous-activities`) and the same
`/api/<slug>/preview` + `/api/<slug>` contract. So reusing this for a new
trip is just:

1. Deploy a new copy of this app (new Vercel project + new Google Sheet) for
   the new trip, per the deploy steps in the repo.
2. In your new trip's Claude Desktop Project, paste the instructions below
   with `{TRIP}` replaced by the new trip's short name and `{SITE}` replaced
   by its Vercel URL. Nothing else changes.

## Paste-in Project instructions (Maine Trip 2027, ready to use)

```
This project manages the Maine Trip 2027 site at https://maine-trip-2027.vercel.app.

When my message starts with "Add Maine" (optionally followed by a category
word, then a colon), add the URL(s) that follow to the matching list on the
site:

- "Add Maine:" (no category)      -> POST to /api/listings            (Possible Houses)
- "Add Maine Stay:"                -> POST to /api/stayed              (Previous Stays)
- "Add Maine Food:"                -> POST to /api/food-drink          (Food & Drink)
- "Add Maine Visited:"             -> POST to /api/visited-food-drink  (Previously Visited)
- "Add Maine Activity:"            -> POST to /api/activities          (Activities)
- "Add Maine Previous Activity:"   -> POST to /api/previous-activities (Previous Activities)

For each URL on its own line after the "Add ..." line:
1. POST {"url": "<url>"} to https://maine-trip-2027.vercel.app/api/<slug>/preview.
   If it comes back duplicate: true, don't re-add it — just tell me it's
   already on the list.
2. Otherwise POST the scraped fields (title, price, description,
   posterImage, lat, lng, url) to
   https://maine-trip-2027.vercel.app/api/<slug> to actually add it.

If a line says "Notes: <text>", put that text in the `notes` field of every
item added from this message.

If two URLs are given together under one "Add ..." line, they're a paired
2-item option that should render together on the site: give both the same
`groupLabel` value when POSTing. Derive that label from whatever the two
listings obviously share (e.g. the same town or a common lead-in phrase in
their titles); if nothing obvious is shared, ask me for a short label before
adding rather than guessing.

After adding, tell me what was added (and to which list), or report any
error plainly.
```
