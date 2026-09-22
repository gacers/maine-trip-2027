import { NextResponse, type NextRequest } from "next/server";
import { getAdminUser, requireWriteAccess, hashApiKey } from "@/lib/auth";
import { getTripBySlug } from "@/lib/sections";
import { ingestUpload, isMediaStoreConfigured } from "@/lib/mediaStore";
import { supabaseServiceRole } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Upload a poster photo to R2. Auth: signed-in admin, or a trip write
// token (invite/editor) when tripSlug is provided, or any non-revoked
// api_keys bearer (same keys used for entry writes).
async function authorizeUpload(request: NextRequest, tripSlug: string | null): Promise<
  { ok: true } | { ok: false; status: number; message: string }
> {
  const admin = await getAdminUser();
  if (admin) return { ok: true };

  if (tripSlug) {
    const trip = await getTripBySlug(tripSlug);
    if (!trip) return { ok: false, status: 404, message: "Unknown trip" };
    const { error } = await requireWriteAccess(request, trip.id, { minRole: "editor" });
    if (error) return { ok: false, status: error.status, message: error.message };
    return { ok: true };
  }

  const auth = request.headers.get("authorization") || "";
  const match = auth.match(/^Bearer\s+(.+)$/i);
  if (match) {
    const token = match[1].trim();
    const { data: key } = await supabaseServiceRole()
      .from("api_keys")
      .select("id, revoked")
      .eq("key_hash", hashApiKey(token))
      .maybeSingle();
    if (key && !key.revoked) return { ok: true };
  }

  return { ok: false, status: 401, message: "Sign in required" };
}

export async function POST(request: NextRequest) {
  if (!isMediaStoreConfigured()) {
    return NextResponse.json(
      { error: "Poster storage is not configured (set S3_* env vars)" },
      { status: 503 }
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart form data" }, { status: 400 });
  }

  const tripSlugRaw = form.get("tripSlug");
  const tripSlug = typeof tripSlugRaw === "string" && tripSlugRaw.trim() ? tripSlugRaw.trim() : null;

  const auth = await authorizeUpload(request, tripSlug);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file is required" }, { status: 400 });
  }

  try {
    const bytes = Buffer.from(await file.arrayBuffer());
    const result = await ingestUpload(bytes, file.type || "");
    return NextResponse.json({ url: result.publicUrl, key: result.key });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
