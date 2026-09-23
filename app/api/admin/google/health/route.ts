import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/auth";
import { checkAllGoogleCredentials } from "@/lib/googleCredentialHealth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Admin-session-only, same reasoning as /api/settings — this isn't
// something a trip-scoped API key should ever be able to trigger.
export async function GET() {
  const user = await getAdminUser();
  if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  const statuses = await checkAllGoogleCredentials();
  return NextResponse.json({ statuses });
}
