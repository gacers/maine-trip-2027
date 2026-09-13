import Link from "next/link";
import { getTripBySlug, getTripNav } from "@/lib/sections";

export const dynamic = "force-dynamic";

export default async function SectionsAdminPage({ params }) {
  const { tripSlug } = await params;
  const trip = await getTripBySlug(tripSlug);
  const nav = await getTripNav(trip.id);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-zinc-900">Sections</h1>
        <Link
          href={`/${tripSlug}/admin/sections/new`}
          className="rounded bg-zinc-900 text-white px-4 py-2 text-sm font-medium"
        >
          + New section
        </Link>
      </div>

      {nav.every((g) => g.sections.length === 0) && (
        <p className="text-zinc-500 text-sm">
          No sections yet — add one to give this trip somewhere to track things.
        </p>
      )}

      {nav.map(
        (group) =>
          group.sections.length > 0 && (
            <div key={group.id} className="flex flex-col gap-2">
              <h2 className="text-sm uppercase tracking-wide text-zinc-500 font-medium">
                {group.label}
              </h2>
              <div className="flex flex-col gap-2">
                {group.sections.map((section) => (
                  <div
                    key={section.id}
                    className="rounded-lg border border-zinc-200 bg-white p-3 flex items-center justify-between"
                  >
                    <div>
                      <div className="font-medium text-zinc-900">{section.label}</div>
                      <div className="text-xs text-zinc-500">/{tripSlug}/{section.slug}</div>
                    </div>
                    <Link
                      href={`/${tripSlug}/admin/sections/${section.slug}/edit`}
                      className="text-sm text-blue-600 hover:underline"
                    >
                      Edit
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          )
      )}
    </div>
  );
}
