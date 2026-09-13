import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Follows a redirect chain server-side — used only to turn a
// share.google / maps.app.goo.gl short link into the full Google Maps
// URL it points to (browser JS can't read a cross-origin redirect's
// final Location due to CORS). Locked to Google's own short-link hosts
// so this can't become a general-purpose URL-fetching proxy.
const ALLOWED_HOSTS = new Set(["share.google", "maps.app.goo.gl", "goo.gl"]);

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  let parsed;
  try {
    parsed = new URL(body.url);
  } catch {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  }
  if (!ALLOWED_HOSTS.has(parsed.hostname.replace(/^www\./, ""))) {
    return NextResponse.json({ error: "Unsupported host" }, { status: 400 });
  }

  try {
    const res = await fetch(parsed.toString(), {
      redirect: "follow",
      headers: { "User-Agent": "Mozilla/5.0 (compatible; TripPlannerBot/1.0)" },
    });
    // Google gates share.google's real redirect behind an "enable
    // JavaScript" interstitial for any non-browser client — a plain
    // server-side fetch (this one included) lands there instead of the
    // actual Maps place page, every time, no matter the User-Agent.
    // Rather than pass that dead end back as a "resolved" URL, treat it
    // as the well-known failure it is.
    if (!res.url.includes("/maps/")) {
      return NextResponse.json(
        {
          error:
            "Google blocks automatic reading of share.google links — try pasting the place name instead, or the full google.com/maps/place/... link.",
        },
        { status: 422 }
      );
    }
    return NextResponse.json({ resolvedUrl: res.url });
  } catch {
    return NextResponse.json({ error: "Couldn't resolve that link" }, { status: 500 });
  }
}
