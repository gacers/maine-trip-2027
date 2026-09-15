"use client";

import { useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Dynamically imported (not a static import up top) so the devtools
// package — sizeable, dev-only tooling — never ends up in the
// production client bundle at all, rather than relying on a
// production-build dead-code-elimination pass to strip it.
const ReactQueryDevtools = dynamic(
  () => import("@tanstack/react-query-devtools").then((m) => m.ReactQueryDevtools),
  { ssr: false }
);

// One QueryClient per browser tab, created once (useState's lazy
// initializer, not a module-level singleton — a module singleton would
// leak one visitor's cached data into another's on the server, and
// Next.js can reuse the module across requests). Every data-fetching
// component (SectionPage today) reads/writes this same cache by query
// key, so navigating between sections re-shows already-fetched data
// instantly instead of re-hitting the server every time, while a real
// mutation (add/patch/delete/rate) still invalidates just the keys it
// actually changed.
export default function QueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Data is "fresh enough" for half a minute — long enough that
            // clicking between nav groups/sections and back doesn't
            // re-fetch, short enough that another contributor's edit
            // shows up on its own well within a normal browsing session.
            staleTime: 30_000,
            // A background refetch (stale data still shown immediately,
            // swapped in when it resolves) covers the rest: reopening a
            // backgrounded tab, or a flaky connection coming back.
            refetchOnWindowFocus: true,
            refetchOnReconnect: true,
            retry: 1,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={client}>
      {children}
      {/* Floating dev-only panel — tree-shaken out of a production
          build entirely (see ReactQueryDevtools' own docs), so this
          isn't a runtime env check, it's dead code elimination. */}
      {process.env.NODE_ENV === "development" && <ReactQueryDevtools initialIsOpen={false} />}
    </QueryClientProvider>
  );
}
