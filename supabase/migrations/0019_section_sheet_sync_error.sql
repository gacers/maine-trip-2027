-- Every write already triggers a best-effort Sheet export
-- (exportSection, never throws — a Sheets hiccup can't be allowed to
-- fail the actual data write that triggered it) that, until now,
-- swallowed a real failure with nothing but a server-side
-- console.error — invisible to the person who'd actually need to know
-- their Sheet just silently fell out of sync with the site. This
-- column is where that failure (or its absence) actually gets
-- recorded, so the UI can show it.
alter table sections add column if not exists sheet_sync_error text;
