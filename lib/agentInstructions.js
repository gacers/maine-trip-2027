// Generates a personal, ready-to-paste instructions file for whoever's
// looking at the Add form and would rather describe a link to their own
// AI agent than fill it in by hand — a friend on an invite link
// (role: "contributor", add/append only, their existing token) or the
// trip owner themselves (role: "owner", full add/edit/archive/delete,
// a fresh key minted on the spot so this is always self-contained).
// Unlike docs/claude-desktop-add-prompts.md (checked into the repo,
// token kept as a placeholder on purpose), this file is generated
// client-side at download time and safe to embed a real token in —
// it's never written to disk or committed anywhere.
export function buildAgentInstructions({ trip, section, siteUrl, token, role }) {
  const base = `${siteUrl}/api/trips/${trip.slug}/sections/${section.slug}/entries`;
  const isOwner = role === "owner";

  const capabilities = isOwner
    ? `- Add a brand new item (a house, restaurant, activity — whatever this
  trip's sections are for) by POSTing to that section's entries endpoint.
- Edit any existing item's fields (title, url, photo, description,
  coordinates, notes, concerns, rank, ...) by PATCHing it.
- Add a note or a concern to an item without replacing the whole list.
- Archive or delete an item.`
    : `- Add a brand new item (a house, restaurant, activity — whatever this
  trip's sections are for) by POSTing to that section's entries endpoint.
- Add a note or a concern to an item that's already on the list.

You can NOT edit an existing item's other details, remove a note/concern,
rank it, or delete/archive it — only the trip owner can do that.`;

  const editSection = isOwner
    ? `

## Editing an existing item

PATCH ${base}/<id>
Header: Authorization: Bearer ${token}
Header: Content-Type: application/json

Body (JSON) — send only the fields you want to change:
{
  "title": "<name>",
  "url": "<link>",
  "posterImage": "<photo URL>",
  "description": "<one idea per line>",
  "lat": <latitude>,
  "lng": <longitude>,
  "rank": <number>,
  "status": "active" | "archived",
  "archiveReason": "<optional, if archiving>",
  "data": { "<section-specific field key>": "<value>" }
}

## Deleting an item

DELETE ${base}/<id>
Header: Authorization: Bearer ${token}`
    : "";

  return `# Adding to "${trip.name}" with your own AI agent

${isOwner ? "This is your own full-access key for" : `You've been invited to add to the "${section.label}" list (and any other list under this trip) for`} ${trip.name}. If you'd rather describe a link to your AI agent and have it do the typing, give it these instructions.

**Before you start — this needs an agent that can actually make live web
requests, not just chat.** A plain conversation in claude.ai or ChatGPT
normally can't do this — it can only draft the request for you, and will
tell you so if you paste this in and ask it to just go do it. It works
with something like Claude Code, or Claude Desktop/ChatGPT with a
fetch-capable tool or MCP connector enabled. If you're not sure whether
your setup qualifies, or don't want to deal with it, it's genuinely
easier to just use the "Add" box on the site itself instead of this file.

Your access key (keep this private — anyone with it can ${isOwner ? "add, edit, and delete" : "add"} on your behalf):

    ${token}

## What you can do

${capabilities}

## Adding a new item

POST ${base}
Header: Authorization: Bearer ${token}
Header: Content-Type: application/json

Body (JSON):
{
  "url": "<link to the listing/place>",
  "title": "<name>",
  "posterImage": "<optional photo URL>",
  "description": "<optional, one idea per line>",
  "lat": <optional latitude>,
  "lng": <optional longitude>,
  "notes": "<optional>",
  "concerns": "<optional>"
}

Only "url" and "title" are required. To add to a different list under
this same trip, swap "${section.slug}" in the URL for that list's slug —
ask the trip owner for the exact list you want, or fetch
${siteUrl}/api/trips/${trip.slug}/sections to see them all.
${editSection}

## Adding a note or concern to an existing item

First find the item's id (it's in the URL of the page as
"#listing-<id>", or from the list endpoint above). Then:

PATCH ${base}/<id>
Header: Authorization: Bearer ${token}
Header: Content-Type: application/json

Body (JSON) — send exactly one of these two fields:
{ "appendNote": "<your note>" }
or
{ "appendConcern": "<your concern>" }

That's it — tell your agent the page you're looking at and what you'd
like added, and paste these instructions in alongside it.
`;
}

// Triggers a browser download of the given text as a .md file — no
// server round-trip, the file only ever exists in the viewer's own
// browser and download folder.
export function downloadTextFile(filename, text) {
  const blob = new Blob([text], { type: "text/markdown" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
