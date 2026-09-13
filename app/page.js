import Link from "next/link";
import { getAllTrips } from "@/lib/sections";

export const dynamic = "force-dynamic";

// The site's new home: a list of every trip, newest first, each linking
// to its own /{tripSlug}. Replaces the old single-trip home page (its
// content now lives at /maine-2027).
export default async function TripsIndexPage() {
  const trips = await getAllTrips();

  return (
    <main className="max-w-2xl mx-auto px-4 py-12 flex flex-col gap-6 w-full">
      <h1 className="text-2xl sm:text-3xl font-bold text-zinc-900 text-center">Trips</h1>

      {trips.length === 0 ? (
        <p className="text-zinc-500 text-sm text-center">No trips yet.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {trips.map((trip) => (
            <li key={trip.id}>
              <Link
                href={`/${trip.slug}`}
                className="block rounded-xl border border-zinc-200 bg-white p-4 shadow-sm hover:border-zinc-400 transition-colors"
              >
                <div className="font-semibold text-zinc-900">{trip.name}</div>
                {trip.subtitle && (
                  <div className="text-sm text-zinc-500 mt-0.5">{trip.subtitle}</div>
                )}
                {trip.start_date && (
                  <div className="text-xs text-zinc-400 mt-1">
                    {new Date(trip.start_date).toLocaleDateString(undefined, {
                      year: "numeric",
                      month: "long",
                    })}
                  </div>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
