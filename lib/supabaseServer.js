import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

// The anon-key client, scoped to the current request's cookies — used for
// everything a normal signed-in-or-not visitor does (reads, and writes
// that go through RLS as that visitor's own identity). Use this in Server
// Components, Server Actions, and Route Handlers.
export async function supabaseServer() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component (not a Route Handler/Server
            // Action) — cookies can't be written there. Fine as long as
            // middleware.js is also refreshing the session; safe to ignore.
          }
        },
      },
    }
  );
}

// The service-role client — bypasses RLS entirely. Server-only, never
// import this from a Client Component. Used for: the migration script,
// and API routes that just verified an Authorization: Bearer API key
// themselves (see lib/auth.js) and need to write on behalf of that key
// rather than an interactive user's session.
export function supabaseServiceRole() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
