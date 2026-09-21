import type { ReactNode } from "react";
import { getAdminUser } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabaseServer";
import HomeShell from "@/components/HomeShell";
import { HomeActionsProvider } from "@/components/HomeShell/HomeActions";

export const dynamic = "force-dynamic";

// Shared header + Trips | Categories | Future Interest stack for the
// home surface only — trip pages keep TripNavHeader instead.
export default async function HomeLayout({ children }: { children: ReactNode }) {
  const admin = await getAdminUser();
  const isAdmin = !!admin;
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isSignedIn = !!user;

  return (
    <HomeActionsProvider>
      <HomeShell isAdmin={isAdmin} isSignedIn={isSignedIn}>
        {children}
      </HomeShell>
    </HomeActionsProvider>
  );
}
