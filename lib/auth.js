import { createHash } from "crypto";
import { supabaseServer, supabaseServiceRole } from "@/lib/supabaseServer";

export function hashApiKey(token) {
  return createHash("sha256").update(token).digest("hex");
}

// Authorizes a write. Two paths:
// 1. `Authorization: Bearer <token>` — for Claude Desktop/automation, or
//    a friend's browser/agent using an invite link (no browser session
//    to carry either way). Hashed and looked up in api_keys; valid means
//    either a global key (trip_id null — owner keys only) or one scoped
//    to this exact trip. A `role: 'contributor'` key (an invite link) is
//    only accepted when the caller explicitly opts in via
//    `allowContributor` — every write route defaults to owner-only,
//    only the entries-create route opts in. On success, returns the
//    service-role client (RLS is bypassed deliberately here — the
//    bearer token itself was the access check, already done above).
// 2. Otherwise, the interactive Supabase session cookie. Returns the
//    request-scoped client acting as that user — RLS's app_admins
//    policy is the real enforcement here, so even a bug in this check
//    can't grant a write the database itself would refuse.
//
// Returns { supabase } on success, { error: { status, message } } on
// failure — callers should check `error` first.
export async function requireWriteAccess(request, tripId = null, { allowContributor = false } = {}) {
  const authHeader = request.headers.get("authorization") || "";
  const bearerMatch = authHeader.match(/^Bearer\s+(.+)$/i);

  if (bearerMatch) {
    const token = bearerMatch[1].trim();
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
    if (key.role === "contributor" && !allowContributor) {
      return { error: { status: 403, message: "This invite link can only add new items, not edit or delete" } };
    }
    // Best-effort — don't block the actual request on this.
    service
      .from("api_keys")
      .update({ last_used_at: new Date().toISOString() })
      .eq("id", key.id)
      .then(() => {});
    return { supabase: service };
  }

  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: { status: 401, message: "Sign in required" } };
  return { supabase };
}

// For gating admin pages (Section Designer, New Trip, API keys) in
// Server Components/layouts — not used by API routes, which use
// requireWriteAccess above instead. Returns the signed-in admin's user
// object, or null if not signed in / not an admin (relies on the
// app_admins_self_read RLS policy so a user's own session client can
// check their own membership row).
export async function getAdminUser() {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from("app_admins").select("user_id").eq("user_id", user.id).maybeSingle();
  return data ? user : null;
}
