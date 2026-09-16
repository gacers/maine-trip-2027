import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Every custom nav group ever created, across every trip — see
// lib/customSectionTemplates.ts for how these get captured. Not
// trip-scoped: a template built on one trip is offered on all of them.
export async function GET() {
  const supabase = await supabaseServer();
  const { data, error } = await supabase
    .from("custom_section_templates")
    .select("id, template_key, nav_group_label, sections")
    .order("nav_group_label", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ templates: data || [] });
}
