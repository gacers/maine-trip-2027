import { NextResponse, type NextRequest } from "next/server";
import { getTripBySlug } from "@/lib/sections";
import { hashApiKey } from "@/lib/auth";
import { supabaseServer, supabaseServiceRole } from "@/lib/supabaseServer";
import { migrateDeviceRatingsToEditor, DEVICE_ID_RE } from "@/lib/ratings";

export const dynamic = "force-dynamic";

// Companion to /become-editor for someone who *already* has a permanent
// login and is signing in from an invite. Become-editor only creates
// new accounts; without this, "Sign in" left them with a session but
// no trip_editors row — so the header kept showing Login / Create
// login / cookie hint instead of Logout. Same invite-token gate as
// become-editor: proof they already had contributor access on this
// trip before we attach the permanent editor link.
//
// `accessToken` in the body is preferred right after client sign-in —
// the session cookie can lag one request behind, and relying on it
// alone left claim-editor returning 401 even though sign-in succeeded.
export async function POST(request: NextRequest, { params }: { params: Promise<{ tripSlug: string }> }) {
  const { tripSlug } = await params;
  const trip = await getTripBySlug(tripSlug);
  if (!trip) return NextResponse.json({ error: "Unknown trip" }, { status: 404 });

  const authHeader = request.headers.get("authorization") || "";
  const bearerMatch = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!bearerMatch) return NextResponse.json({ error: "Missing invite token" }, { status: 401 });

  let body: { deviceId?: string; accessToken?: string } = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const service = supabaseServiceRole();
  const { data: key, error: keyError } = await service
    .from("api_keys")
    .select("id, trip_id, revoked, role")
    .eq("key_hash", hashApiKey(bearerMatch[1].trim()))
    .maybeSingle();
  if (keyError) return NextResponse.json({ error: "Auth check failed" }, { status: 500 });
  if (!key || key.revoked || key.role !== "contributor" || key.trip_id !== trip.id) {
    return NextResponse.json({ error: "Invalid invite link for this trip" }, { status: 403 });
  }

  let userId: string | null = null;
  const accessToken = typeof body.accessToken === "string" ? body.accessToken.trim() : "";
  if (accessToken) {
    const { data, error } = await service.auth.getUser(accessToken);
    if (error || !data.user) {
      return NextResponse.json({ error: "Invalid session — try signing in again" }, { status: 401 });
    }
    userId = data.user.id;
  } else {
    const supabase = await supabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json(
        { error: "Sign in first, then we can attach this trip to your login" },
        { status: 401 },
      );
    }
    userId = user.id;
  }

  const { error: linkError } = await service.from("trip_editors").upsert({ trip_id: trip.id, user_id: userId });
  if (linkError) return NextResponse.json({ error: linkError.message }, { status: 500 });

  if (body.deviceId && DEVICE_ID_RE.test(body.deviceId)) {
    try {
      await migrateDeviceRatingsToEditor(service, body.deviceId, userId);
    } catch (err) {
      console.error("Rating migration to existing editor account failed:", err);
    }
  }

  return NextResponse.json({ ok: true });
}
