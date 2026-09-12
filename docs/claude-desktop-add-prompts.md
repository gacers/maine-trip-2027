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

The site's own `/preview` scraper is regex-based and weak in practice — on a
real Airbnb listing it returned a generic title ("Vacation home in Jonesport
· ★5.0 · ...") and no price at all. Use it only for the two things it's
reliably good for (photo + coordinates + duplicate check); get the title,
price, and description by actually reading the listing page yourself.

1. `POST {site}/api/{apiSlug}/preview` with body `{"url": "<url>"}`.
   - If the response is `{"duplicate": true, "existing": {...}}`, stop here
     — don't add it again, just tell the user it's already on the list
     (mention its title).
   - Otherwise you get `{"duplicate": false, "scraped": {posterImage, lat,
     lng, ...}}` — keep `posterImage`, `lat`, `lng` from this if present;
     ignore its `title`/`price`/`description`, they're too unreliable to use
     as-is.
2. Visit the actual listing URL and read it yourself. From the real page,
   work out:
   - **Title**: write it as `"<Town> - <House nickname>"` to match the
     convention already used on the site (e.g. "Jonesport - Sea Duck
     Cottage", "Gouldsboro - Schoodic East") — not the page's raw SEO title.
   - **Price**: only include one if the page actually shows a total or
     nightly rate. Airbnb often won't show a price without check-in/check-out
     dates selected — if the pasted URL has `check_in`/`check_out` query
     params, that's the date range to price for; if you still can't get a
     real number, leave price out and tell the user rather than guessing.
     Never carry over a price from a previous add of the same listing
     without saying so — prices change, and doing this silently misleads
     the user about how current the number is.
   - **Description**: a handful of short bullet lines (one fact per line, no
     trailing punctuation) covering bedroom/bed/bath counts, location, and
     standout features — matching the style of existing entries in the
     sheet, not a copy-pasted paragraph.
3. `POST {site}/api/{apiSlug}` with: your title, your price (or omit the
   field if you couldn't confirm one), your description, `posterImage`/`lat`/
   `lng` from step 1, plus:
   - `notes`: the text after `Notes:`, if given (same text on every item in
     this message).
   - `groupLabel`: only when two URLs were given together (see below).
4. Report back what got added (title + which list), and explicitly flag
   anything you couldn't confirm (most commonly: price) rather than staying
   silent about it.

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

For each URL given, in this order:

1. POST {"url": "<url>"} to https://maine-trip-2027.vercel.app/api/<slug>/preview.
   If it comes back duplicate: true, stop — don't re-add it, just tell me
   it's already on the list (name it). Otherwise, keep `posterImage`, `lat`,
   and `lng` from the response if present — but ignore its `title` and
   `price`, they come from a weak regex scraper and are usually wrong or
   missing (e.g. it once returned "Vacation home in Jonesport · ★5.0 ..." as
   a title and no price at all for a real listing).

2. Actually visit the listing URL yourself and read the real page to work
   out:
   - Title, written as "<Town> - <House nickname>" (matching the style
     already on the site, e.g. "Jonesport - Sea Duck Cottage") — never the
     page's raw SEO title.
   - Price, ONLY if the page actually shows one. If the URL has
     check_in/check_out query params, that's the date range to price for.
     If you can't get a real number (common — Airbnb often hides price
     without dates selected), leave the price field out entirely and tell
     me so in your reply. Never reuse a price from a previous add of the
     same listing without explicitly telling me it's not freshly checked —
     prices change, and silently carrying one over is misleading.
   - A short bullet-point description (one fact per line: bedroom/bed/bath
     counts, location, standout features) in the style already used in the
     sheet, not a pasted paragraph.

3. POST the assembled item (your title/price/description plus posterImage/
   lat/lng from step 1) to https://maine-trip-2027.vercel.app/api/<slug>.

If a line says "Notes: <text>", put that text in the `notes` field of every
item added from this message.

If two URLs are given together under one "Add ..." line, they're a paired
2-item option that should render together on the site: give both the same
`groupLabel` value when POSTing. Derive that label from whatever the two
listings obviously share (e.g. the same town or a common lead-in phrase in
their titles); if nothing obvious is shared, ask me for a short label before
adding rather than guessing.

After adding, tell me what was added (and to which list), and call out
anything you couldn't confirm — especially price — rather than staying
quiet about it. Report any error plainly too.
```
