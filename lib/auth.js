import { createHash } from "crypto";
import { supabaseServer, supabaseServiceRole } from "@/lib/supabaseServer";

export function hashApiKey(token) {
  return createHash("sha256").update(token).digest("hex");
}

// Authorizes a write. Two paths:
// 1. `Authorization: Bearer <token>` — for Claude Desktop/automation
//    (no browser session to carry). Hashed and looked up in api_keys;
//    valid means either a global key (trip_id null) or one scoped to
//    this exact trip. On success, returns the service-role client
//    (RLS is bypassed deliberately here — the bearer token itself was
//    the access check, already done above).
// 2. Otherwise, the interactive Supabase session cookie. Returns the
//    request-scoped client acting as that user — RLS's app_admins
//    policy is the real enforcement here, so even a bug in this check
//    can't grant a write the database itself would refuse.
//
// Returns { supabase } on success, { error: { status, message } } on
// failure — callers should check `error` first.
export async function requireWriteAccess(request, tripId = null) {
  const authHeader = request.headers.get("authorization") || "";
  const bearerMatch = authHeader.match(/^Bearer\s+(.+)$/i);

  if (bearerMatch) {
    const token = bearerMatch[1].trim();
    const service = supabaseServiceRole();
    const { data: keys, error } = await service
      .from("api_keys")
      .select("id, trip_id, revoked")
      .eq("key_hash", hashApiKey(token))
      .limit(1);
    if (error) return { error: { status: 500, message: "Auth check failed" } };
    const key = keys?.[0];
    if (!key || key.revoked) return { error: { status: 401, message: "Invalid API key" } };
    if (key.trip_id && tripId && key.trip_id !== tripId) {
      return { error: { status: 403, message: "This API key isn't valid for this trip" } };
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
