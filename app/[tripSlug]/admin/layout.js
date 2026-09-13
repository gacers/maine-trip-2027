import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getAdminUser } from "@/lib/auth";
import { getTripBySlug } from "@/lib/sections";

export const dynamic = "force-dynamic";

export default async function TripAdminLayout({ children, params }) {
  const { tripSlug } = await params;
  const trip = await getTripBySlug(tripSlug);
  if (!trip) notFound();

  const user = await getAdminUser();
  if (!user) redirect(`/login?next=/${tripSlug}/admin/sections`);

  return (
    <main className="max-w-3xl mx-auto px-4 pb-16 pt-6 flex flex-col gap-6 w-full">
      <div className="flex flex-col items-center gap-2">
        <Link href={`/${trip.slug}`} className="text-xs text-zinc-500 hover:underline">
          &larr; Back to {trip.name}
        </Link>
        <nav className="flex gap-2">
          <Link
            href={`/${tripSlug}/admin/sections`}
            className="rounded-full border border-zinc-300 bg-white px-4 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
          >
            Sections
          </Link>
          <Link
            href={`/${tripSlug}/admin/api-keys`}
            className="rounded-full border border-zinc-300 bg-white px-4 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
          >
            API Keys
          </Link>
        </nav>
      </div>
      {children}
    </main>
  );
}
