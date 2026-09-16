"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/Button";
import { supabaseBrowser } from "@/lib/supabaseBrowser";

export interface LogoutButtonProps {
  /** Where to land after signing out — omit to just refresh in place
   * (fine for a plain trip page, which is publicly viewable either
   * way). Pass this when signing out could otherwise strand someone on
   * a page that needs the access they just gave up (e.g. an /admin
   * route) rather than degrading gracefully in place. */
  redirectTo?: string;
}

// The one sign-out control in the whole app — previously there wasn't
// one anywhere, for an admin or a permanent-login editor alike (see
// TripNavHeader, which is this component's only caller so far).
export default function LogoutButton({ redirectTo }: LogoutButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    await supabaseBrowser().auth.signOut();
    if (redirectTo) router.push(redirectTo);
    router.refresh();
    setLoading(false);
  }

  return (
    <Button variant="link" size="sm" onClick={handleClick} disabled={loading}>
      {loading ? "Logging out..." : "Logout"}
    </Button>
  );
}
