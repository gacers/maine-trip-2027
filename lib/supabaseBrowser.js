"use client";

import { createBrowserClient } from "@supabase/ssr";

// One client per page load, shared by every Client Component that needs
// it (e.g. the login form). Anon-key only — never put the service-role
// key anywhere that ships to the browser.
let client = null;

export function supabaseBrowser() {
  if (!client) {
    client = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );
  }
  return client;
}
