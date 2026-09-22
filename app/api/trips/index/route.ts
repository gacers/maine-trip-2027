import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/auth";
import { getEditorTripIds } from "@/lib/tripEditors";
import { supabaseServer } from "@/lib/supabaseServer";
import { getAllTrips, getDefaultSectionHrefsForTrips, sanitizeTripForClient } from "@/lib/sections";
import type { Trip } from "@/lib/types";

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

/** Trips index payload — replaces heavy SSR on `/`. */
export async function GET() {
  try {
    const todayIso = new Date().toISOString().slice(0, 10);
    const [allTrips, admin, supabase] = await Promise.all([
      getAllTrips(),
      getAdminUser(),
      supabaseServer(),
    ]);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const isAdmin = !!admin;
    const isSignedIn = !!user;

    let trips = allTrips;
    let filterByInviteTokens = false;

    if (!isAdmin) {
      const editorIds = await getEditorTripIds();
      if (editorIds.length > 0) {
        const idSet = new Set(editorIds);
        trips = allTrips.filter((t) => idSet.has(t.id));
      } else {
        filterByInviteTokens = true;
      }
    }

    const hrefs = await getDefaultSectionHrefsForTrips(trips);
    const items = trips
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
          href: hrefs.get(trip.id) || `/${trip.slug}`,
        };
      })
      .sort((a, b) => {
        if (a.past !== b.past) return a.past ? 1 : -1;
        if (!a.past) {
          return (a.trip.start_date || "9999").localeCompare(b.trip.start_date || "9999");
        }
        return (b.trip.end_date || b.trip.start_date || "").localeCompare(
          a.trip.end_date || a.trip.start_date || ""
        );
      });

    return NextResponse.json({ items, filterByInviteTokens, isAdmin, isSignedIn });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
