import { NextResponse, type NextRequest } from "next/server";
import { isDevBypassEnabled, DEV_ADMIN_COOKIE, DEV_SUPER_ADMIN_COOKIE } from "@/lib/devAuth";

export const dynamic = "force-dynamic";

// Local-dev-only: GET /api/dev/admin sets a cookie that every trip
// page/layout and requireWriteAccess (see lib/auth.ts) treats as "the
// real signed-in admin," without an actual Supabase Auth session —
// GET /api/dev/admin?on=0 clears it. Add ?super=1 to also set the
// separate super-admin cookie (see SUPER_ADMIN_EMAIL/isSuperAdminUser
// in lib/auth.ts — currently just gates the itinerary feature) on top
// of it; omitting ?super explicitly clears that cookie too, so this is
// a single toggle between 3 states (signed out / admin / super admin)
// rather than two independent switches that could drift out of sync
// (a lingering super-admin cookie from an earlier visit outliving the
// plain-admin one it was set alongside). This route doesn't even exist
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

  const params = new URL(request.url).searchParams;
  const on = params.get("on") !== "0";
  const wantsSuper = params.get("super") === "1";
  const redirectTo = request.headers.get("referer") || new URL("/", request.url).toString();
  const res = NextResponse.redirect(redirectTo);
  if (on) {
    res.cookies.set(DEV_ADMIN_COOKIE, "1", { path: "/", httpOnly: true, sameSite: "lax" });
  } else {
    res.cookies.delete(DEV_ADMIN_COOKIE);
  }
  if (on && wantsSuper) {
    res.cookies.set(DEV_SUPER_ADMIN_COOKIE, "1", { path: "/", httpOnly: true, sameSite: "lax" });
  } else {
    res.cookies.delete(DEV_SUPER_ADMIN_COOKIE);
  }
  return res;
}
