"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { COLLECTIONS, GROUPS } from "@/lib/collections";

function pillClasses(active, size = "text-sm px-4 py-1.5") {
  return `rounded-full border font-medium transition-colors ${size} ${
    active
      ? "bg-zinc-900 text-white border-zinc-900"
      : "bg-white text-zinc-700 border-zinc-300 hover:bg-zinc-50"
  }`;
}

export default function NavHeader() {
  const pathname = usePathname();

  const activeGroup =
    GROUPS.find((g) => g.members.some((key) => COLLECTIONS[key].pageSlug === pathname)) ||
    GROUPS[0];

  return (
    <header className="max-w-4xl mx-auto w-full px-4 pt-8 pb-4 flex flex-col items-center gap-3">
      <h1 className="text-2xl sm:text-3xl font-bold text-zinc-900 text-center">
        Maine Coast Trip &mdash; July 2027
      </h1>
      <nav className="flex flex-wrap justify-center gap-2">
        {GROUPS.map((g) => (
          <Link
            key={g.key}
            href={COLLECTIONS[g.members[0]].pageSlug}
            className={pillClasses(g.key === activeGroup.key)}
          >
            {g.navLabel}
          </Link>
        ))}
      </nav>
      <nav className="flex flex-wrap justify-center gap-2">
        {activeGroup.members.map((key) => {
          const c = COLLECTIONS[key];
          return (
            <Link
              key={key}
              href={c.pageSlug}
              className={pillClasses(pathname === c.pageSlug, "text-xs px-3 py-1")}
            >
              {c.subNavLabel}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
