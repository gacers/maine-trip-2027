import type { ReactNode } from "react";
import HomeShellBootstrap from "@/components/HomeShell/HomeShellBootstrap";
import { HomeActionsProvider } from "@/components/HomeShell/HomeActions";

// Static shell — chrome loads once via /api/home-shell; nav no longer
// re-runs Supabase on every tab click.
export default function HomeLayout({ children }: { children: ReactNode }) {
  return (
    <HomeActionsProvider>
      <HomeShellBootstrap>{children}</HomeShellBootstrap>
    </HomeActionsProvider>
  );
}
