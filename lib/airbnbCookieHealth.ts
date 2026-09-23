import { supabaseServiceRole } from "@/lib/supabaseServer";

export interface AirbnbCookieStatus {
  key: "airbnb";
  label: string;
  ok: boolean;
  message: string;
  checkedAt: string;
}

// Airbnb has no API/OAuth/service-account equivalent to check or
// rotate — AIRBNB_SESSION_COOKIE is a real logged-in browser session's
// raw Cookie header, captured by hand (see lib/scrape.ts's own header
// comment) and pasted into an env var. There's no "regenerate" call to
// make here the way there is for Google; the only way to know it's
// still good is to actually use it, the same way lib/scrape.ts's own
// listing fetch does — including its same "a real listing page is
// 500KB+; anything shorter with this 404-shaped text is Airbnb's
// disguised block page" detection.
export async function checkAirbnbCookie(): Promise<AirbnbCookieStatus> {
  const checkedAt = new Date().toISOString();
  const label = "Airbnb (session cookie)";
  const cookie = process.env.AIRBNB_SESSION_COOKIE;
  if (!cookie) {
    return { key: "airbnb", label, ok: false, message: "AIRBNB_SESSION_COOKIE is not set", checkedAt };
  }

  // Tests against a real Airbnb listing already saved somewhere on the
  // site rather than one hardcoded URL — a fixed target could itself
  // get delisted someday and produce a false "broken" reading that's
  // actually got nothing to do with the cookie.
  const supabase = supabaseServiceRole();
  const { data } = await supabase.from("entries").select("url").ilike("url", "%airbnb.%").limit(1).maybeSingle();
  if (!data?.url) {
    return { key: "airbnb", label, ok: true, message: "No Airbnb listing saved yet to test against — can't confirm either way", checkedAt };
  }

  try {
    const res = await fetch(data.url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        Cookie: cookie,
      },
      redirect: "follow",
    });
    if (!res.ok) {
      return { key: "airbnb", label, ok: false, message: `Airbnb returned HTTP ${res.status}`, checkedAt };
    }
    const html = await res.text();
    const blocked = html.length < 20000 && /404 Page Not Found|page you.re looking for/i.test(html);
    if (blocked) {
      return {
        key: "airbnb",
        label,
        ok: false,
        message: "Airbnb served its disguised block/404 page — the session cookie is likely expired",
        checkedAt,
      };
    }
    return { key: "airbnb", label, ok: true, message: "Working", checkedAt };
  } catch (err) {
    return { key: "airbnb", label, ok: false, message: (err as Error).message, checkedAt };
  }
}
