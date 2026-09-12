"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { COLLECTION_LIST } from "@/lib/collections";

export default function NavHeader() {
  const pathname = usePathname();

  return (
    <header className="max-w-4xl mx-auto w-full px-4 pt-8 pb-4 flex flex-col items-center gap-3">
      <h1 className="text-2xl sm:text-3xl font-bold text-zinc-900 text-center">
        Maine Coast Trip &mdash; July 2027
      </h1>
      <nav className="flex flex-wrap justify-center gap-2">
        {COLLECTION_LIST.map((c) => {
          const active = pathname === c.pageSlug;
          return (
            <Link
              key={c.key}
              href={c.pageSlug}
              className={`rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
                active
                  ? "bg-zinc-900 text-white border-zinc-900"
                  : "bg-white text-zinc-700 border-zinc-300 hover:bg-zinc-50"
              }`}
            >
              {c.navLabel}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
