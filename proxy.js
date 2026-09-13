import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";

// Refreshes the Supabase auth session cookie on every request that isn't
// a static asset or API route — standard @supabase/ssr App Router
// pattern (file renamed from middleware.js to proxy.js per Next.js 16;
// same behavior, just a naming change upstream). Without this, a
// signed-in admin's session silently expires mid-visit instead of being
// kept alive.
export async function proxy(request) {
  let response = NextResponse.next({ request });

  // Supabase isn't configured yet (e.g. mid-setup, or a local checkout
  // without .env.local filled in) — pass every request through
  // unmodified rather than crashing the whole site on every single
  // request. Once real values are set, this branch stops being hit.
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return response;
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Touches the session so @supabase/ssr can refresh/rewrite the cookie
  // if needed — the return value itself isn't used here.
  await supabase.auth.getUser();

  return response;
}

export const config = {
  matcher: [
    // Every route except static assets and API routes (API routes handle
    // their own auth via lib/auth.js, including the bearer-token path
    // that has no cookie session at all).
    "/((?!_next/static|_next/image|favicon.ico|api/).*)",
  ],
};
