import { NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/auth";
import { checkAllGoogleCredentials } from "@/lib/googleCredentialHealth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Super-admin-only (see lib/auth.ts's own requireSuperAdmin) — a
// regular admin (there can be more than one; not every admin should
// see credential internals, let alone the push route below rewriting
// production secrets) never gets past this.
export async function GET() {
  const { error: authError } = await requireSuperAdmin();
  if (authError) return NextResponse.json({ error: authError.message }, { status: authError.status });

  const statuses = await checkAllGoogleCredentials();
  return NextResponse.json({ statuses });
}
