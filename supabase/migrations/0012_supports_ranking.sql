-- Rank display/editing was piggybacking on has_map (via comparisonMode in
-- SectionPage.jsx), but has_map is really about map complexity (full
-- ListingMap w/ driving times vs a plain SimplePlaceMap) — every section
-- ended up with has_map=true and so every section showed a Rank input,
-- which only actually makes sense for a still-deciding-among-options list
-- like Possible Houses. Decoupled into its own per-section toggle.
alter table sections add column if not exists supports_ranking boolean not null default false;
