import { createHash } from "crypto";
import { cookies } from "next/headers";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { supabaseServer, supabaseServiceRole } from "@/lib/supabaseServer";
import { isDevBypassEnabled, DEV_ADMIN_COOKIE, DEV_SUPER_ADMIN_COOKIE, DEV_ADMIN_USER_ID, DEV_CONTRIBUTOR_TOKEN } from "@/lib/devAuth";
import { checkEditorForTrip } from "@/lib/tripEditors";

export function hashApiKey(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

// See lib/devAuth.ts for what this is and why it's safe — folds to
// `false` outside `next dev`, so this always returns false on any real
// build/deploy without even reading a cookie.
async function hasDevAdminCookie(): Promise<boolean> {
  if (!isDevBypassEnabled) return false;
  const store = await cookies();
  return store.get(DEV_ADMIN_COOKIE)?.value === "1";
}

// A stand-in for a real Supabase Auth User, used only by the dev-admin
// bypass — every real caller of getAdminUser only ever checks
// truthiness (`!!admin`) or passes it straight through as `isAdmin`,
// never reads a specific field off it, so this only needs to satisfy
// the type, not actually resemble a real account.
const DEV_ADMIN_USER = {
  id: DEV_ADMIN_USER_ID,
  app_metadata: {},
  user_metadata: {},
  aud: "dev",
  created_at: new Date(0).toISOString(),
} as User;

// See lib/devAuth.ts — the separate super-admin dev cookie, checked
// only once we already know we're looking at the dev-admin stand-in
// (a real admin's own super-admin check never touches this).
async function hasDevSuperAdminCookie(): Promise<boolean> {
  if (!isDevBypassEnabled) return false;
  const store = await cookies();
  return store.get(DEV_SUPER_ADMIN_COOKIE)?.value === "1";
}

export interface WriteAccessError {
  status: number;
  message: string;
}

export interface WriteAccessSuccess {
  supabase: SupabaseClient;
  raterKey: string;
  error?: undefined;
}

export interface WriteAccessFailure {
  error: WriteAccessError;
  supabase?: undefined;
  raterKey?: undefined;
}

export type WriteAccessResult = WriteAccessSuccess | WriteAccessFailure;

// Authorizes a write. Two paths:
// 1. `Authorization: Bearer <token>` — for Claude Desktop/automation, or
//    a friend's browser/agent using an invite link (no browser session
//    to carry either way). Hashed and looked up in api_keys; valid means
//    either a global key (trip_id null — owner keys only) or one scoped
//    to this exact trip. A `role: 'contributor'` key (an invite link) is
//    only accepted when the caller allows at least `minRole: "editor"`
//    — every write route defaults to "admin", only the routes a
//    contributor/editor can genuinely use (add, edit, archive — never
//    delete or trip config) opt in. On success, returns the service-role
//    client (RLS is bypassed deliberately here — the bearer token itself
//    was the access check, already done above).
// 2. Otherwise, the interactive Supabase session cookie. For a
//    "editor"-eligible route, first checks trip_editors explicitly (same
//    as the bearer-contributor path — see checkEditorForTrip) and, if it
//    matches, ALSO returns the service-role client: RLS itself only
//    knows about app_admins, so an editor's own RLS-scoped session
//    client would be refused the exact same write RLS refuses anyone
//    else non-admin. Otherwise returns the plain request-scoped client
//    acting as that user — RLS's app_admins policy is the real
//    enforcement for every "admin"-only route, so even a bug in this
//    function can't grant a write the database itself would refuse.
//
// Returns { supabase, raterKey } on success, { error: { status, message } }
// on failure — callers should check `error` first. `raterKey` identifies
// *who* just authenticated ("key:<api_keys.id>" for a bearer token,
// "admin:<user.id>" for an admin session, "editor:<user.id>" for an
// editor session) — used by entry_ratings to tell one rater's own score
// apart from another's; every other caller ignores it.
export async function requireWriteAccess(
  request: Request,
  tripId: string | null = null,
  { minRole = "admin" }: { minRole?: "editor" | "admin" } = {}
): Promise<WriteAccessResult> {
  const authHeader = request.headers.get("authorization") || "";
  const bearerMatch = authHeader.match(/^Bearer\s+(.+)$/i);

  if (bearerMatch) {
    const token = bearerMatch[1].trim();

    // See lib/devAuth.ts — a fixed token standing in for a real invite
    // link's api_keys row, recognized only in `next dev`. Same minRole
    // gate a real contributor key gets below.
    if (isDevBypassEnabled && token === DEV_CONTRIBUTOR_TOKEN) {
      if (minRole !== "editor") {
        return { error: { status: 403, message: "This invite link can only add new items, not edit or delete" } };
      }
      return { supabase: supabaseServiceRole(), raterKey: "key:dev-contributor" };
    }

    const service = supabaseServiceRole();
    const { data: keys, error } = await service
      .from("api_keys")
      .select("id, trip_id, revoked, role")
      .eq("key_hash", hashApiKey(token))
      .limit(1);
    if (error) return { error: { status: 500, message: "Auth check failed" } };
    const key = keys?.[0];
    if (!key || key.revoked) return { error: { status: 401, message: "Invalid API key" } };
    if (key.trip_id && tripId && key.trip_id !== tripId) {
      return { error: { status: 403, message: "This key isn't valid for this trip" } };
    }
    if (key.role === "contributor" && minRole !== "editor") {
      return { error: { status: 403, message: "This invite link can only add new items, not edit or delete" } };
    }
    // Best-effort — don't block the actual request on this.
    service
      .from("api_keys")
      .update({ last_used_at: new Date().toISOString() })
      .eq("id", key.id)
      .then(() => {});
    return { supabase: service, raterKey: `key:${key.id}` };
  }

  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    // See lib/devAuth.ts — the /api/dev/admin cookie, `next dev` only.
    // Service-role client here for the same reason the dev-contributor
    // bearer token above uses it: there's no real Supabase Auth session
    // for RLS's app_admins policy to check.
    if (await hasDevAdminCookie()) {
      return { supabase: supabaseServiceRole(), raterKey: "admin:dev" };
    }
    return { error: { status: 401, message: "Sign in required" } };
  }

  // A real editor session for this exact trip gets the same treatment
  // as a contributor's bearer token above — checked explicitly (not
  // left to RLS, which has no concept of trip_editors) before falling
  // through to the plain admin-or-bust session path below.
  if (minRole === "editor" && tripId) {
    const { data: adminRow } = await supabase.from("app_admins").select("user_id").eq("user_id", user.id).maybeSingle();
    if (!adminRow && (await checkEditorForTrip(supabase, user.id, tripId))) {
      const service = supabaseServiceRole();
      service
        .from("trip_editors")
        .update({ last_active_at: new Date().toISOString() })
        .eq("trip_id", tripId)
        .eq("user_id", user.id)
        .then(() => {});
      return { supabase: service, raterKey: `editor:${user.id}` };
    }
  }

  return { supabase, raterKey: `admin:${user.id}` };
}

// Gates a *read* — every trip's real content (entries, the search/
// preview endpoints that expose them) used to be open to anyone who
// knew or guessed the URL; TripAccessGate blocks the UI from ever
// getting there, but that's a client-side convenience, not real
// protection against a direct request. This admits the same 3
// identities requireWriteAccess does, just with no role tier to clear:
// a contributor's invite-link key is exactly as good as an admin/editor
// session for reading, unlike for writes (see requireWriteAccess's own
// minRole gate) — there's no "read-only" invite link today, so any
// valid, trip-scoped key is enough. Every read call site that already
// sends this trip's authToken for writes (see useSectionEntries's own
// authHeaders, AddEntryForm's) already sends it on reads too, so a
// legitimate contributor sees no change; only a request carrying
// neither a session nor a key gets refused now.
export async function requireReadAccess(request: Request, tripId: string): Promise<WriteAccessResult> {
  const authHeader = request.headers.get("authorization") || "";
  const bearerMatch = authHeader.match(/^Bearer\s+(.+)$/i);

  if (bearerMatch) {
    const token = bearerMatch[1].trim();

    if (isDevBypassEnabled && token === DEV_CONTRIBUTOR_TOKEN) {
      return { supabase: supabaseServiceRole(), raterKey: "key:dev-contributor" };
    }

    const service = supabaseServiceRole();
    const { data: keys, error } = await service
      .from("api_keys")
      .select("id, trip_id, revoked")
      .eq("key_hash", hashApiKey(token))
      .limit(1);
    if (error) return { error: { status: 500, message: "Auth check failed" } };
    const key = keys?.[0];
    if (!key || key.revoked) return { error: { status: 401, message: "Invalid access link" } };
    if (key.trip_id && key.trip_id !== tripId) {
      return { error: { status: 403, message: "This key isn't valid for this trip" } };
    }
    // Best-effort — don't block the actual request on this.
    service
      .from("api_keys")
      .update({ last_used_at: new Date().toISOString() })
      .eq("id", key.id)
      .then(() => {});
    return { supabase: service, raterKey: `key:${key.id}` };
  }

  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    if (await hasDevAdminCookie()) {
      return { supabase: supabaseServiceRole(), raterKey: "admin:dev" };
    }
    return { error: { status: 401, message: "Sign in or an invite link required" } };
  }

  const { data: adminRow } = await supabase.from("app_admins").select("user_id").eq("user_id", user.id).maybeSingle();
  if (adminRow) return { supabase, raterKey: `admin:${user.id}` };

  if (await checkEditorForTrip(supabase, user.id, tripId)) {
    return { supabase: supabaseServiceRole(), raterKey: `editor:${user.id}` };
  }

  return { error: { status: 403, message: "You don't have access to this trip" } };
}

// For gating admin pages (Section Designer, New Trip, API keys) in
// Server Components/layouts — not used by API routes, which use
// requireWriteAccess above instead. Returns the signed-in admin's user
// object, or null if not signed in / not an admin (relies on the
// app_admins_self_read RLS policy so a user's own session client can
// check their own membership row) — or, in `next dev` only, a stand-in
// user if the /api/dev/admin cookie is set (see lib/devAuth.ts), so
// every one of this function's callers gets the bypass for free.
export async function getAdminUser(): Promise<User | null> {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    const { data } = await supabase.from("app_admins").select("user_id").eq("user_id", user.id).maybeSingle();
    if (data) return user;
  }
  return (await hasDevAdminCookie()) ? DEV_ADMIN_USER : null;
}

// A further restriction on top of regular admin — currently the only
// thing this gates is the itinerary feature, still being tested
// privately before other admins/contributors see it (a real app_admins
// row can outlive this: a future second admin wouldn't automatically
// get itinerary access just from being an admin). Take the `User |
// null` a caller already has (typically from getAdminUser above)
// rather than re-fetching it, since every real caller already needed
// that check first anyway. Locally, the dev-admin stand-in's own
// super-admin-ness is a separate cookie (see lib/devAuth.ts) so a
// regular "admin but not super admin" can still be simulated too, not
// just "admin = always super admin" in dev.
export const SUPER_ADMIN_EMAIL = "gary.acers@gmail.com";

export async function isSuperAdminUser(user: User | null): Promise<boolean> {
  if (!user) return false;
  if (user.id === DEV_ADMIN_USER_ID) return hasDevSuperAdminCookie();
  return user.email === SUPER_ADMIN_EMAIL;
}

// For the itinerary API routes: a real signed-in session belonging to
// the super admin (or the dev-bypass equivalent), full stop — no
// bearer-token path at all, unlike requireWriteAccess/requireReadAccess.
// An invite-link contributor or a global automation API key never
// identifies a specific email, so neither can ever satisfy "is this
// gary.acers@gmail.com" — this feature just isn't reachable that way
// right now. Returns the service-role client on success: getAdminUser
// having returned non-null already means this is a confirmed
// app_admins row (or the dev stand-in), so there's no narrower RLS-
// scoped client worth using here the way an editor session gets one.
export async function requireSuperAdmin(): Promise<
  { supabase: SupabaseClient; error?: undefined } | { error: WriteAccessError; supabase?: undefined }
> {
  const admin = await getAdminUser();
  if (!admin) return { error: { status: 401, message: "Sign in required" } };
  if (!(await isSuperAdminUser(admin))) {
    return { error: { status: 403, message: "This feature isn't available yet" } };
  }
  return { supabase: supabaseServiceRole() };
}
