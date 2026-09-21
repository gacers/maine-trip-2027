import { getAllTrips, sanitizeTripForClient } from "@/lib/sections";
import { getAdminUser } from "@/lib/auth";
import { getEditorTripIds } from "@/lib/tripEditors";
import { supabaseServer } from "@/lib/supabaseServer";
import AccessibleTripsIndex, { type TripListItem } from "@/components/AccessibleTripsIndex";
import type { Trip } from "@/lib/types";

export const dynamic = "force-dynamic";

// A real date range once a trip has an end_date set (see
// TripSettingsForm/NewTripForm), not just "July 2027" for the whole
// thing — collapses shared month/year rather than repeating them
// ("July 1–8, 2027", "Dec 28, 2027 – Jan 3, 2028"). Falls back to the
// old month/year-only label when there's no end date yet.
function tripDateLabel(startDate: string | null | undefined, endDate: string | null | undefined): string | null {
  if (!startDate) return null;
  const start = new Date(startDate);
  if (!endDate) {
    return start.toLocaleDateString(undefined, { year: "numeric", month: "long" });
  }
  const end = new Date(endDate);
  const sameYear = start.getFullYear() === end.getFullYear();
  const sameMonth = sameYear && start.getMonth() === end.getMonth();
  if (sameMonth) {
    const month = start.toLocaleDateString(undefined, { month: "long" });
    return `${month} ${start.getDate()}–${end.getDate()}, ${start.getFullYear()}`;
  }
  const startLabel = start.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: sameYear ? undefined : "numeric",
  });
  const endLabel = end.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  return `${startLabel} – ${endLabel}`;
}

// Past = explicitly marked Completed (see TripSettingsForm) OR its own
// end date (or start date, if that's all it has) has already gone by.
// Everything else — no dates yet, or dates still ahead — is Pending,
// the first/default list.
function isPastTrip(trip: Trip, todayIso: string): boolean {
  if (trip.completed) return true;
  const referenceDate = trip.end_date || trip.start_date;
  return !!referenceDate && referenceDate < todayIso;
}

function toListItems(trips: Trip[], todayIso: string): TripListItem[] {
  return trips
    .map((trip) => {
      const safe = sanitizeTripForClient(trip)!;
      return {
        trip: {
          id: safe.id,
          slug: safe.slug,
          name: safe.name,
          cover_image: safe.cover_image,
          start_date: safe.start_date,
          end_date: safe.end_date,
          completed: safe.completed,
        },
        dateLabel: tripDateLabel(trip.start_date, trip.end_date),
        past: isPastTrip(trip, todayIso),
      };
    })
    .sort((a, b) => {
      if (a.past !== b.past) return a.past ? 1 : -1;
      if (!a.past) {
        return (a.trip.start_date || "9999").localeCompare(b.trip.start_date || "9999");
      }
      return (b.trip.end_date || b.trip.start_date || "").localeCompare(a.trip.end_date || a.trip.start_date || "");
    });
}

// The site's home Trips tab — trips the current viewer can actually
// open, split into Pending / Past. Chrome (header + stack nav) lives
// in the (home) layout.
export default async function TripsIndexPage() {
  const allTrips = await getAllTrips();
  const todayIso = new Date().toISOString().slice(0, 10);
  const admin = await getAdminUser();
  const isAdmin = !!admin;
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isSignedIn = !!user;

  let trips = allTrips;
  let filterByInviteTokens = false;

  if (isAdmin) {
    // Full list.
  } else {
    const editorIds = await getEditorTripIds();
    if (editorIds.length > 0) {
      const idSet = new Set(editorIds);
      trips = allTrips.filter((t) => idSet.has(t.id));
    } else {
      filterByInviteTokens = true;
      trips = allTrips;
    }
  }

  const items = toListItems(trips, todayIso);

  return (
    <AccessibleTripsIndex
      items={items}
      filterByInviteTokens={filterByInviteTokens}
      isAdmin={isAdmin}
      isSignedIn={isSignedIn}
    />
  );
}
