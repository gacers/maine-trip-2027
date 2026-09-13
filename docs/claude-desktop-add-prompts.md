# "Add <Trip>: ..." prompts for Claude Desktop

Reference for the Claude Desktop Project custom instructions that let you type
a one-line message to add an item to this site, instead of using the web UI.

**Requires an agent that can make live web requests, not just chat.**
Confirmed with a friend's plain claude.ai conversation: it correctly
recognized these as instructions to POST/PATCH, but had no live internet
access to actually do it — it could only draft the request. This needs
Claude Desktop (or another agent) with a fetch-capable tool/MCP connector
actually enabled, not the bare chat interface. If you're setting this up
for someone and aren't sure their setup has that, the site's own Add form
works fine on its own — this is strictly an optional shortcut.

**Updated for the multi-trip/Supabase rewrite** — the URL shape, auth
requirement, and request body all changed from the original single-trip
version of this doc. If you're re-pasting instructions into an existing
Claude Desktop Project, replace the whole thing with the block at the bottom,
not just parts of it.

## The pattern

```
Add <Trip>[ <Category>]: <url>
[<url2>]
[Notes: <free text>]
```

- **`<Trip>`** — the trip's short name (`Maine` today). Maps to a specific
  trip slug (`maine-2027`) in the instructions below — this word itself is
  just what you type, not parsed.
- **`<Category>`** (optional) — picks which section the item goes into. Omit
  it and it defaults to the trip's main "possible houses" section.
- **One or two URLs**, one per line. Two URLs = a paired 2-item option (e.g.
  two houses booked together) — both get added with the same `groupLabel` so
  the site renders them as one linked unit.
- **`Notes:`** (optional, last line) — free text applied to the `notes` field
  of every item just added.

## Auth (new — this didn't exist in the single-trip version)

The site now has real access control. Every write needs an
`Authorization: Bearer <token>` header — generate one from the site itself:
sign in at `/login`, go to `/<tripSlug>/admin/api-keys`, click **Generate
key**, and paste the value (shown once) into the instructions below in place
of `<API_KEY>`. A key is scoped to one trip; generate a new one for each
future trip's Claude Desktop Project.

## Category → section → API mapping (Maine Trip 2027)

Site base URL: `https://www.countrygothtravel.com`. Trip slug: `maine-2027`.

| Trigger | Section | section slug |
|---|---|---|
| `Add Maine:` (no category) | Possible Houses | `houses` |
| `Add Maine Stay:` | Previous Stays | `previous-stays` |
| `Add Maine Food:` | Food & Drink | `food-drink` |
| `Add Maine Visited:` | Previously Visited | `previously-visited` |
| `Add Maine Activity:` | Activities | `activities` |
| `Add Maine Previous Activity:` | Previous Activities | `previous-activities` |

Every section's URL is `/api/trips/maine-2027/sections/<section-slug>/entries`
(plus `/preview` for the scrape-assist endpoint, `/<id>` for a single entry).

## What Claude should actually do, per URL

The site's own `/preview` scraper is regex-based and weak in practice — on a
real Airbnb listing it returned a generic title ("Vacation home in Jonesport
· ★5.0 · ...") and no price at all. Use it only for the two things it's
reliably good for (photo + coordinates + duplicate check); get the title,
price, and description by actually reading the listing page yourself.

1. `POST {site}/api/trips/maine-2027/sections/<slug>/preview` with body
   `{"url": "<url>"}` — no auth needed, this endpoint is read-only.
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
     standout features — matching the style of existing entries on the site,
     not a copy-pasted paragraph. (Bedroom/bed/bathroom counts don't need to
     be typed separately — the site auto-extracts them from this text.)
3. `POST {site}/api/trips/maine-2027/sections/<slug>/entries` **with
   `Authorization: Bearer <API_KEY>`** and a JSON body shaped like:
   ```json
   {
     "url": "...", "title": "...", "posterImage": "...", "description": "...",
     "lat": 44.5, "lng": -67.5, "notes": "...", "groupLabel": "...",
     "data": { "price": "$450/night" }
   }
   ```
   `data` holds this section's own fields (for Houses/Previous Stays that's
   just `price` — bedrooms/beds/bathrooms auto-fill from the description).
   Omit any field you don't have; only `url` and `title` are required.
4. Report back what got added (title + which list), and explicitly flag
   anything you couldn't confirm (most commonly: price) rather than staying
   silent about it.

### Deriving `groupLabel` for a paired (2-URL) add

The site groups two items into one card/map/rank whenever they share a
non-empty `groupLabel`. You're not told a label explicitly, so derive one:
- If both scraped titles share an obvious common lead-in before a separator
  (e.g. `"Gouldsboro - Schoodic East"` / `"Gouldsboro - Harbor House"` share
  `"Gouldsboro"`), use that shared piece as the label.
- Otherwise, use the two titles' shared town/neighborhood if it appears in
  both descriptions, or fall back to asking the user for a short label
  before adding (better to ask once than to silently mis-group).
- Set the exact same `groupLabel` string on both items' POST bodies.

## Adding a note or concern to an existing entry

Notes and Concerns are each a bulleted list on the site (and export as a
multi-line list in the Sheet too), not a single block of text — the same
"+ Add note" button on the site appends one more bullet rather than
replacing the whole thing. If asked in chat to add a note or concern to
something already on the list (e.g. "add a note to Jonesport that the host
confirmed early check-in"), find the entry (GET the section's `/entries` and
match by title), then:

```
PATCH https://www.countrygothtravel.com/api/trips/maine-2027/sections/<slug>/entries/<id>
Authorization: Bearer <API_KEY>
{"appendNote": "Host confirmed early check-in is fine."}
```

Use `"appendConcern"` the same way for a concern. Don't try to build the
combined multi-line string yourself — the server appends it correctly to
whatever's already there.

## Generalizing to a future trip

Every trip on this site works identically — creating one (`/trips/new`) and
adding sections to it (`/<slug>/admin/sections/new`) needs no code or
redeploy. For a new trip's Claude Desktop Project:

1. Create the trip and whatever sections it needs through the site's own
   admin UI (or clone Maine's 6-section shape if that fits).
2. Generate an API key for it at `/<new-slug>/admin/api-keys`.
3. Paste the instructions below with `maine-2027` replaced by the new trip's
   slug, the category table updated to match its actual sections, and
   `<API_KEY>` replaced by the new key.

## Paste-in Project instructions (Maine Trip 2027, ready to use)

```
This project manages the Maine Trip 2027 site at https://www.countrygothtravel.com,
trip slug "maine-2027". Writes need Authorization: Bearer <API_KEY> — replace
<API_KEY> below with the real key before using this.

When my message starts with "Add Maine" (optionally followed by a category
word, then a colon), add the URL(s) that follow to the matching section:

- "Add Maine:" (no category)      -> section slug "houses"               (Possible Houses)
- "Add Maine Stay:"                -> section slug "previous-stays"       (Previous Stays)
- "Add Maine Food:"                -> section slug "food-drink"           (Food & Drink)
- "Add Maine Visited:"             -> section slug "previously-visited"   (Previously Visited)
- "Add Maine Activity:"            -> section slug "activities"           (Activities)
- "Add Maine Previous Activity:"   -> section slug "previous-activities"  (Previous Activities)

For each URL given, in this order:

1. POST {"url": "<url>"} to
   https://www.countrygothtravel.com/api/trips/maine-2027/sections/<slug>/preview
   (no auth needed). If it comes back duplicate: true, stop — don't re-add
   it, just tell me it's already on the list (name it). Otherwise, keep
   `posterImage`, `lat`, and `lng` from the response if present — but ignore
   its `title` and `price`, they come from a weak regex scraper and are
   usually wrong or missing (e.g. it once returned "Vacation home in
   Jonesport · ★5.0 ..." as a title and no price at all for a real listing).

2. Actually visit the listing URL yourself and read the real page to work
   out:
   - Title, written as "<Town> - <House nickname>" (matching the style
     already on the site, e.g. "Jonesport - Sea Duck Cottage") — never the
     page's raw SEO title.
   - Price, ONLY if the page actually shows one. If the URL has
     check_in/check_out query params, that's the date range to price for.
     If you can't get a real number (common — Airbnb often hides price
     without dates selected), leave it out entirely and tell me so in your
     reply. Never reuse a price from a previous add of the same listing
     without explicitly telling me it's not freshly checked — prices
     change, and silently carrying one over is misleading.
   - A short bullet-point description (one fact per line: bedroom/bed/bath
     counts, location, standout features) — bedroom/bed/bathroom counts
     auto-fill from this text, don't send them separately.

3. POST to https://www.countrygothtravel.com/api/trips/maine-2027/sections/<slug>/entries
   with header "Authorization: Bearer <API_KEY>" and JSON body:
   {"url": "...", "title": "...", "posterImage": "...", "description": "...",
    "lat": ..., "lng": ..., "notes": "...", "groupLabel": "...",
    "data": {"price": "..."}}
   (only "url" and "title" are required; omit anything you don't have —
   "data" is where this section's own fields go, just "price" for Houses/
   Previous Stays).

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
