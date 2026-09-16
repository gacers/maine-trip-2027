// Shared section-naming conventions — the smaller pieces reused across
// several places instead of retyped by hand each time, which is
// exactly how a real trip (Scotland 2027) ended up with a stray
// "Possible Houses"/"Previous Houses" pair: SECTION_TEMPLATES' own
// wording for the 3 built-in categories (lib/sectionTemplates.ts) was
// renamed to "Stay Options"/"Stayed Before" at some point, but nothing
// there needed touching here since it was already each category's own
// single source of truth — the actual duplication was this "Previously
// Visited" prefix, hand-typed in more than one place for a brand-new
// custom section's own counterpart.
export const PREVIOUSLY_VISITED_PREFIX = "Previously Visited";
