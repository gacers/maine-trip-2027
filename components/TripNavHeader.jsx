"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

function pillClasses(active, size = "text-sm px-4 py-1.5") {
  return `rounded-full border font-medium transition-colors ${size} ${
    active
      ? "bg-zinc-900 text-white border-zinc-900"
      : "bg-white text-zinc-700 border-zinc-300 hover:bg-zinc-50"
  }`;
}

// `nav` is this trip's nav_groups, each with its member `sections`
// already attached and sorted (see lib/sections.js's getTripNav) —
// entirely data-driven per trip, replacing the old hardcoded
// GROUPS/COLLECTIONS constants.
export default function TripNavHeader({ trip, nav: allNav }) {
  const pathname = usePathname();
  const sectionPath = (slug) => `/${trip.slug}/${slug}`;

  // A nav group with zero sections (e.g. its last section got deleted,
  // or none has been added to it yet) has nothing to link to — skip it
  // rather than render a link to "/{trip}/undefined".
  const nav = allNav.filter((g) => g.sections.length > 0);
  const activeGroup =
    nav.find((g) => g.sections.some((s) => sectionPath(s.slug) === pathname)) || nav[0];

  return (
    <header className="max-w-4xl mx-auto w-full px-4 pt-8 pb-4 flex flex-col items-center gap-3">
      <div className="flex items-center gap-3">
        <Link href="/" className="text-xs text-zinc-500 hover:underline">
          &larr; All trips
        </Link>
        <Link href={`/${trip.slug}/admin/sections`} className="text-xs text-zinc-500 hover:underline">
          Manage
        </Link>
      </div>
      <h1 className="text-2xl sm:text-3xl font-bold text-zinc-900 text-center">{trip.name}</h1>

      {nav.length > 0 && (
        <nav className="flex flex-wrap justify-center gap-2">
          {nav.map((g) => (
            <Link
              key={g.id}
              href={sectionPath(g.sections[0]?.slug)}
              className={pillClasses(g.id === activeGroup?.id)}
            >
              {g.label}
            </Link>
          ))}
        </nav>
      )}

      {activeGroup && activeGroup.sections.length > 0 && (
        <nav className="flex flex-wrap justify-center gap-2">
          {activeGroup.sections.map((s) => (
            <Link
              key={s.id}
              href={sectionPath(s.slug)}
              className={pillClasses(pathname === sectionPath(s.slug), "text-xs px-3 py-1")}
            >
              {s.sub_nav_label || s.label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}
