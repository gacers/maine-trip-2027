// Local-dev-only test shortcuts for two things that are otherwise a
// pain to set up by hand every time: viewing/testing a trip as its
// real signed-in admin, and as a visitor who followed a real invite
// link. Every check gated on `isDevBypassEnabled` below, which is
// `false` for any real build (Vercel — preview or production — always
// runs `next build`, which always sets NODE_ENV to "production"
// regardless of which branch/environment it's building; only
// `next dev` sets it to "development"). NODE_ENV is inlined at build
// time (webpack's DefinePlugin), so this constant folds to a literal
// `false` — and every `if (isDevBypassEnabled)` branch that guards a
// bypass with it — outside of `next dev`, dead code eliminated, not
// just "false at runtime." There is no way to activate any of this on
// a deployed environment even by guessing the cookie/token values.
//
// Usage (see app/api/dev/admin/route.ts and lib/auth.ts):
// - Admin: visit /api/dev/admin once (any trip page, or the admin
//   sections/API-keys pages, then all treat you as the real signed-in
//   admin, no real Supabase Auth session needed). /api/dev/admin?on=0
//   turns it back off.
// - Contributor/invite link: visit any trip page with
//   ?invite=dev-contributor-token once — same as a real invite link,
//   using lib/inviteClient.ts's existing capture/persist flow as-is,
//   just with a token requireWriteAccess recognizes without a real
//   api_keys row.
export const isDevBypassEnabled = process.env.NODE_ENV !== "production";

export const DEV_ADMIN_COOKIE = "dev-admin";
export const DEV_CONTRIBUTOR_TOKEN = "dev-contributor-token";
