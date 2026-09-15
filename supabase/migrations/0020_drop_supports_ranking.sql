-- The manual Rank feature (an admin-editable per-entry number, gated by
-- this per-section toggle) is retired — ratings/average-score already
-- replaced it as the real "which one's winning" signal, and this
-- toggle's own UI ("Show the manual Rank input") is being removed.
-- entries.rank itself stays: it's still the default insertion-order
-- sort key for every section regardless of this toggle, just no longer
-- manually editable from the site.
alter table sections drop column if exists supports_ranking;
