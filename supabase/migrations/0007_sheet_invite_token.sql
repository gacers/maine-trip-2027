-- A contributor api_key created automatically the first time a trip's
-- Google Sheet is exported, and baked into every link the Sheet itself
-- generates back to the site (see lib/sheetsExport.js). Its whole point
-- is to be seen by everyone the Sheet is shared with — that's how
-- "share the Sheet with a friend" turns into real edit access on the
-- site without a separate invite link — so it's kept in plaintext here
-- (unlike api_keys.key_hash) purely so exportSection can keep reusing
-- it. sheet_invite_key_id lets a rotate action revoke the old api_keys
-- row directly instead of re-deriving it from the hash.
alter table trips add column sheet_invite_token text;
alter table trips add column sheet_invite_key_id uuid references api_keys(id) on delete set null;
