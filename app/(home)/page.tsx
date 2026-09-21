import { getAllTrips, getTripNav, sanitizeTripForClient } from "@/lib/sections";
import { getAdminUser } from "@/lib/auth";
import { getEditorTripIds } from "@/lib/tripEditors";
import { supabaseServer } from "@/lib/supabaseServer";
import AccessibleTripsIndex, { type TripListItem } from "@/components/AccessibleTripsIndex";
import type { Trip } from "@/lib/types";

export const dynamic = "force-dynamic";

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

function isPastTrip(trip: Trip, todayIso: string): boolean {
  if (trip.completed) return true;
  const referenceDate = trip.end_date || trip.start_date;
  return !!referenceDate && referenceDate < todayIso;
}

async function tripHref(trip: Trip): Promise<string> {
  const nav = await getTripNav(trip.id);
  const firstGroup = nav.find((g) => g.sections.some((s) => s.enabled));
  const firstSection = firstGroup?.sections.find((s) => s.enabled);
  if (!firstGroup || !firstSection) return `/${trip.slug}`;
  return `/${trip.slug}/${firstGroup.slug}/${firstSection.slug}`;
}

async function toListItems(trips: Trip[], todayIso: string): Promise<TripListItem[]> {
  const hrefs = await Promise.all(trips.map((t) => tripHref(t)));
  return trips
    .map((trip, i) => {
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
        href: hrefs[i],
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

  const items = await toListItems(trips, todayIso);

  return (
    <AccessibleTripsIndex
      items={items}
      filterByInviteTokens={filterByInviteTokens}
      isAdmin={isAdmin}
      isSignedIn={isSignedIn}
    />
  );
}
