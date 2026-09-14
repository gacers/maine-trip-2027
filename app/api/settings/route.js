import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Site-wide settings — deliberately admin-*session*-only (unlike entry
// writes, which also accept an API key for automation like Claude
// Desktop). An API key is scoped to adding trip content, not changing
// where every trip's exports get created.

export async function GET() {
  const user = await getAdminUser();
  if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  const supabase = await supabaseServer();
  const { data, error } = await supabase.from("app_settings").select("*").eq("id", true).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ settings: data });
}

export async function PATCH(request) {
  const user = await getAdminUser();
  if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const patch = {};
  if ("googleDriveFolderId" in body) patch.google_drive_folder_id = body.googleDriveFolderId || null;
  if ("siteUrl" in body) patch.site_url = body.siteUrl || null;
  if ("contactEmail" in body) patch.contact_email = body.contactEmail || null;

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "No editable fields provided" }, { status: 400 });
  }

  const supabase = await supabaseServer();
  const { data, error } = await supabase
    .from("app_settings")
    .update(patch)
    .eq("id", true)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ settings: data });
}
