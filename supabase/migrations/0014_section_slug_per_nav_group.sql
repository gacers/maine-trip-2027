-- Section URLs are now nested under their nav group's own slug
-- (/{tripSlug}/{navGroupSlug}/{sectionSlug} instead of a flat
-- /{tripSlug}/{sectionSlug}) so every category can reuse the same
-- friendly leaf slugs ("options", "previously-visited", ...) instead
-- of needing a trip-wide-unique one per section. A section's slug only
-- needs to be unique within its own nav group now.
alter table sections drop constraint if exists sections_trip_id_slug_key;
alter table sections add constraint sections_nav_group_id_slug_key unique (nav_group_id, slug);
