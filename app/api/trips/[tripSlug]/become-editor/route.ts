import { NextResponse, type NextRequest } from "next/server";
import { getTripBySlug } from "@/lib/sections";
import { hashApiKey } from "@/lib/auth";
import { supabaseServiceRole } from "@/lib/supabaseServer";
import { migrateDeviceRatingsToEditor, DEVICE_ID_RE } from "@/lib/ratings";

export const dynamic = "force-dynamic";

// Called from CreateLoginPrompt right when a contributor (invite-link)
// asks to create a real login. Creates the account server-side via the
// service-role admin API rather than the client-side signUp() — this
// project deliberately has public sign-up disabled (see login/page.tsx's
// own comment: "There's no public sign-up"), confirmed live
// ("Signups not allowed for this instance" from a real signUp() call
// while building this), and that's a real security boundary this
// route shouldn't quietly bypass for anyone who merely asks — it's
// gated on the same proof requireWriteAccess's contributor path
// already trusts: a valid, non-revoked contributor api_keys row for
// this exact trip (the same one the invite link itself is). The
// client still finishes the job with a normal signInWithPassword —
// admin-created users don't get an active session for free, and that
// call isn't blocked by the disabled-signup setting (that only gates
// NEW accounts, not signing in with valid credentials).
export async function POST(request: NextRequest, { params }: { params: Promise<{ tripSlug: string }> }) {
  const { tripSlug } = await params;
  const trip = await getTripBySlug(tripSlug);
  if (!trip) return NextResponse.json({ error: "Unknown trip" }, { status: 404 });

  const authHeader = request.headers.get("authorization") || "";
  const bearerMatch = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!bearerMatch) return NextResponse.json({ error: "Missing invite token" }, { status: 401 });

  let body: { email?: string; password?: string; deviceId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const email = body.email?.trim();
  const password = body.password;
  if (!email || !password) return NextResponse.json({ error: "Email and password are required" }, { status: 400 });

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

  const { data: created, error: createError } = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (createError) {
    // The real message ("A user with this email address has already
    // been registered") is exactly what someone needs to hear here —
    // an existing editor adding a second trip from a fresh invite link
    // isn't handled by this form (see InviteLinksManager's own "add an
    // existing editor" flow instead); this just tells them to sign in.
    return NextResponse.json({ error: createError.message }, { status: 400 });
  }

  const { error: linkError } = await service
    .from("trip_editors")
    .upsert({ trip_id: trip.id, user_id: created.user.id });
  if (linkError) return NextResponse.json({ error: linkError.message }, { status: 500 });

  // Best-effort — a migration hiccup shouldn't fail an account that
  // was otherwise created successfully; worst case they just see blank
  // stars where their own ratings used to show, same as before this
  // existed. See migrateDeviceRatingsToEditor's own comment for why
  // this needs to happen here at all.
  if (body.deviceId && DEVICE_ID_RE.test(body.deviceId)) {
    try {
      await migrateDeviceRatingsToEditor(service, body.deviceId, created.user.id);
    } catch (err) {
      console.error("Rating migration to new editor account failed:", err);
    }
  }

  return NextResponse.json({ ok: true });
}
