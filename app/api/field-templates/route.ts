import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Every named field (key+label+type) ever defined on any section,
// across every trip — see lib/customFieldTemplates.ts for how these
// get captured. Not trip- or section-scoped: a field defined once is
// offered everywhere.
export async function GET() {
  const supabase = await supabaseServer();
  const { data, error } = await supabase
    .from("custom_field_templates")
    .select("id, field_key, label, field_type, show_on_overview, required, options")
    .order("label", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ templates: data || [] });
}
