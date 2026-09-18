import { NextResponse, type NextRequest } from "next/server";
import { getTripBySlug } from "@/lib/sections";
import { requireWriteAccess } from "@/lib/auth";
import { buildInviteUrl, looksLikeEmail, sendInviteEmail } from "@/lib/email";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Sends a trip invite email via Resend. The invite token must already
// exist (created by POST /api-keys); this route only builds the link
// and delivers it — no mailto / local mail client.
export async function POST(request: NextRequest, { params }: { params: Promise<{ tripSlug: string }> }) {
  const { tripSlug } = await params;
  const trip = await getTripBySlug(tripSlug);
  if (!trip) return NextResponse.json({ error: "Unknown trip" }, { status: 404 });

  const { error: authError } = await requireWriteAccess(request, trip.id);
  if (authError) return NextResponse.json({ error: authError.message }, { status: authError.status });

  let body: { email?: string; token?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim() : "";
  const token = typeof body.token === "string" ? body.token.trim() : "";
  if (!looksLikeEmail(email)) {
    return NextResponse.json({ error: "A valid email is required" }, { status: 400 });
  }
  if (!token) {
    return NextResponse.json({ error: "Invite token is required" }, { status: 400 });
  }

  const inviteUrl = buildInviteUrl(trip.slug, token, email);

  try {
    await sendInviteEmail({ to: email, tripName: trip.name, inviteUrl });
    return NextResponse.json({ ok: true, inviteUrl });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }
}
