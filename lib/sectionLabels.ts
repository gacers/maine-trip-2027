// Shared section-naming conventions — the smaller pieces reused across
// several places instead of retyped by hand each time, which is
// exactly how a real trip (Scotland 2027) ended up with a stray
// "Possible Houses"/"Previous Houses" pair: SECTION_TEMPLATES' own
// wording for the 3 built-in categories (lib/sectionTemplates.ts) was
// renamed to "Stay Options"/"Stayed Before" at some point, but nothing
// there needed touching here since it was already each category's own
// single source of truth — the actual duplication was this prefix,
// hand-typed in more than one place for a brand-new custom section's
// own counterpart. "Visited" (not "Previously Visited") — shorter, and
// "Visited" is already this app's own established word for the same
// idea everywhere else (see EntryCard's VisitedControl).
export const VISITED_PREFIX = "Visited";

// A still-deciding "primary" tier (Options, or any lone/standalone
// section) always sorts before its own already-decided "past" tier
// (Previous/Past/Visited/Stayed Before — the exact word varies, the
// order never should) within the same nav group. Every section-
// creation call site that knows it's creating one half of such a pair
// passes one of these explicitly — the alternative, leaving both at
// the section POST route's own bare default, is exactly how this went
// wrong in the first place: with sort_order tied, display order fell
// back to whatever order Postgres's own embedded-relation query
// happened to return for that request, which nothing in this app
// actually controls (confirmed live: several real trips' Food & Drink
// and Activities showing their Past tier before Options, inconsistently,
// with no code change involved — the DB row order alone flipped it).
export const PRIMARY_TIER_SORT_ORDER = 0;
export const PAST_TIER_SORT_ORDER = 1;

// The same "is this a past/done tier" check SectionForm's own
// PrefillPanel gating uses (see looksLikePastTier there) — duplicated
// here as a single string constant so any future consumer (including a
// one-off data-fix script) can share the exact same rule instead of
// hand-rolling its own regex.
export const PAST_TIER_PATTERN = /previous|visited|past/i;

// Shared with SectionForm's own PrefillPanel gating and SectionsAdmin's
// drag-to-reorder guard — one shared implementation of "is this section
// the already-decided half of an Options/Past pair" rather than each
// consumer hand-rolling the same regex test.
export function looksLikePastTier(s: { slug: string; label: string; sub_nav_label?: string | null }): boolean {
  return PAST_TIER_PATTERN.test(`${s.slug} ${s.label} ${s.sub_nav_label || ""}`);
}
