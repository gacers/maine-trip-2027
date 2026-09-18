import { NextResponse, type NextRequest } from "next/server";
import { getTripBySlug } from "@/lib/sections";
import { getContactEmail } from "@/lib/settings";
import { looksLikeEmail, sendAccessRequestEmail } from "@/lib/email";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Public — strangers on the private-trip gate use this. Delivers to
// app_settings.contact_email via Resend (never trusts a client-supplied
// "to"). Reply-To is the requester so you can answer from your inbox.
export async function POST(request: NextRequest, { params }: { params: Promise<{ tripSlug: string }> }) {
  const { tripSlug } = await params;
  const trip = await getTripBySlug(tripSlug);
  if (!trip) return NextResponse.json({ error: "Unknown trip" }, { status: 404 });

  const contactEmail = await getContactEmail();
  if (!contactEmail || !looksLikeEmail(contactEmail)) {
    return NextResponse.json({ error: "Access requests aren't configured for this site yet" }, { status: 503 });
  }

  let body: { email?: string; message?: string; sectionLabel?: string; pageUrl?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const requesterEmail = typeof body.email === "string" ? body.email.trim() : "";
  if (!looksLikeEmail(requesterEmail)) {
    return NextResponse.json({ error: "Your email is required so we can reply" }, { status: 400 });
  }

  const message = typeof body.message === "string" ? body.message.trim().slice(0, 2000) : "";
  const sectionLabel = typeof body.sectionLabel === "string" ? body.sectionLabel.trim().slice(0, 200) : "";
  const pageUrl = typeof body.pageUrl === "string" ? body.pageUrl.trim().slice(0, 500) : "";

  try {
    await sendAccessRequestEmail({
      to: contactEmail,
      tripName: trip.name,
      tripSlug: trip.slug,
      requesterEmail,
      message: message || undefined,
      sectionLabel: sectionLabel || undefined,
      pageUrl: pageUrl || undefined,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }
}
