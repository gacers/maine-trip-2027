// Generates a personal, ready-to-paste instructions file for a friend
// who followed an invite link and would rather ask their own AI agent
// (Claude Desktop, etc.) to add things than fill in the form by hand.
// Unlike docs/claude-desktop-add-prompts.md (checked into the repo,
// token kept as a placeholder on purpose), this file is generated
// client-side at download time and safe to embed the friend's real
// token in — it's never written to disk or committed anywhere.
export function buildContributorInstructions({ trip, section, siteUrl, token }) {
  const base = `${siteUrl}/api/trips/${trip.slug}/sections/${section.slug}/entries`;

  return `# Adding to "${trip.name}" with your own AI agent

You've been invited to add to the "${section.label}" list (and any other
list under this trip) for ${trip.name}. If you'd rather describe a link
to your AI agent and have it do the typing, give it these instructions.

Your access key (keep this private — anyone with it can add on your behalf):

    ${token}

## What you can do

- Add a brand new item (a house, restaurant, activity — whatever this
  trip's sections are for) by POSTing to that section's entries endpoint.
- Add a note or a concern to an item that's already on the list.

You can NOT edit an existing item's details, remove a note/concern, rank
it, or delete/archive it — only the trip owner can do that.

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
// server round-trip, the file only ever exists in the friend's own
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
