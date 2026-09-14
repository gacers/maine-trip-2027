import { NextResponse, type NextRequest } from "next/server";
import { isDevBypassEnabled, DEV_ADMIN_COOKIE } from "@/lib/devAuth";

export const dynamic = "force-dynamic";

// Local-dev-only: GET /api/dev/admin sets a cookie that every trip
// page/layout and requireWriteAccess (see lib/auth.ts) treats as "the
// real signed-in admin," without an actual Supabase Auth session —
// GET /api/dev/admin?on=0 clears it. This route doesn't even exist
// outside `next dev` — isDevBypassEnabled is `false` for any real
// build/deploy (see lib/devAuth.ts), so this always 404s there before
// touching a cookie at all.
//
// Redirects back to wherever you came from (or / if there's no
// referer) so this is a one-click "start testing as admin" link —
// visit it once from any page, then just browse normally.
export async function GET(request: NextRequest) {
  if (!isDevBypassEnabled) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const on = new URL(request.url).searchParams.get("on") !== "0";
  const redirectTo = request.headers.get("referer") || new URL("/", request.url).toString();
  const res = NextResponse.redirect(redirectTo);
  if (on) {
    res.cookies.set(DEV_ADMIN_COOKIE, "1", { path: "/", httpOnly: true, sameSite: "lax" });
  } else {
    res.cookies.delete(DEV_ADMIN_COOKIE);
  }
  return res;
}
