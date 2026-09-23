import { NextResponse, type NextRequest } from "next/server";
import { getAdminUser } from "@/lib/auth";
import { updateEnvVar, triggerRedeploy } from "@/lib/vercelEnv";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Every env var this route is willing to overwrite — deliberately not
// "any key the caller names": this is a write path straight into
// production's own secrets, so it only ever touches the Google
// credentials it exists for. Notably excludes GOOGLE_OAUTH_CLIENT_ID/
// _SECRET (rotating those means creating a whole new OAuth client, not
// just swapping a value) and the GOOGLE_KEY_ADMIN_*/VERCEL_API_TOKEN
// pair that powers this very pipeline — if either of those ever needs
// rotating, that has to happen by hand in Vercel's own dashboard, not
// through the mechanism they're the ones enabling.
const PUSHABLE_KEYS = new Set([
  "GOOGLE_SERVICE_ACCOUNT_EMAIL",
  "GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY",
  "GOOGLE_OAUTH_REFRESH_TOKEN",
  "GOOGLE_MAPS_SERVER_API_KEY",
  "NEXT_PUBLIC_GOOGLE_MAPS_API_KEY",
]);

// Admin-session-only — same bar as everything else under
// /api/admin/google. Pushes one credential's new value to this
// project's own Vercel env vars and redeploys so it actually takes
// effect (an existing running deployment already has last build's
// values baked in). Redeploy is fire-and-check, not fire-and-wait — a
// real build can take a couple of minutes, longer than this route
// should sit open; the caller re-runs the health check afterward to
// confirm it landed.
export async function POST(request: NextRequest) {
  const user = await getAdminUser();
  if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const key = typeof body.key === "string" ? body.key.trim() : "";
  const value = typeof body.value === "string" ? body.value : "";
  if (!key || !value) return NextResponse.json({ error: "key and value are required" }, { status: 400 });
  if (!PUSHABLE_KEYS.has(key)) {
    return NextResponse.json({ error: `${key} can't be pushed through this route` }, { status: 400 });
  }

  try {
    await updateEnvVar(key, value);
    const deployment = await triggerRedeploy();
    return NextResponse.json({ ok: true, deployment });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
