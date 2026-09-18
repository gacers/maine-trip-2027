import { NextResponse, type NextRequest } from "next/server";
import { getTripBySlug } from "@/lib/sections";
import { requireWriteAccess } from "@/lib/auth";
import { supabaseServiceRole } from "@/lib/supabaseServer";
import type { TripEditor } from "@/lib/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Admin-only, same lockdown as api_keys — lists every permanent-login
// editor on this trip (see supabase/migrations/0021_trip_editors.sql),
// enriched with their email via the Admin API since trip_editors only
// stores user_id (auth.users isn't a table this project's REST schema
// exposes directly). Excludes anyone who's also a global admin — a
// trip_editors row can exist for them (nothing stops an admin from
// going through "Create a permanent login" like anyone else), but
// requireWriteAccess's own admin check always wins over trip_editors
// (see its own comment), so revoking that row would do nothing:
// they'd keep editing regardless. Listing them here anyway just
// invites a confusing no-op "Revoke".
export async function GET(request: NextRequest, { params }: { params: Promise<{ tripSlug: string }> }) {
  const { tripSlug } = await params;
  const trip = await getTripBySlug(tripSlug);
  if (!trip) return NextResponse.json({ error: "Unknown trip" }, { status: 404 });

  const { error: authError } = await requireWriteAccess(request, trip.id);
  if (authError) return NextResponse.json({ error: authError.message }, { status: authError.status });

  try {
    const service = supabaseServiceRole();
    const { data: rows, error } = await service
      .from("trip_editors")
      .select("user_id, created_at, last_active_at")
      .eq("trip_id", trip.id)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    const { data: adminRows, error: adminError } = await service.from("app_admins").select("user_id");
    if (adminError) throw new Error(adminError.message);
    const adminIds = new Set((adminRows || []).map((a) => a.user_id));
    const nonAdminRows = (rows || []).filter((r) => !adminIds.has(r.user_id));

    const editors: TripEditor[] = await Promise.all(
      nonAdminRows.map(async (r) => {
        const { data } = await service.auth.admin.getUserById(r.user_id);
        return {
          user_id: r.user_id,
          email: data.user?.email || "(unknown)",
          created_at: r.created_at,
          last_active_at: r.last_active_at,
        };
      })
    );
    return NextResponse.json({ editors });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
