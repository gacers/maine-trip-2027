import { NextResponse, type NextRequest } from "next/server";
import { requireSiteEditorAccess } from "@/lib/auth";
import { scrapeListing, normalizeListingUrl } from "@/lib/scrape";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Site-level URL preview for Future Interest Add — same scrape as trip
// entry preview, without needing a trip/section context.
export async function POST(request: NextRequest) {
  const { error: authError } = await requireSiteEditorAccess();
  if (authError) return NextResponse.json({ error: authError.message }, { status: authError.status });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const rawUrl = typeof body.url === "string" ? body.url.trim() : "";
  if (!rawUrl) return NextResponse.json({ error: "url is required" }, { status: 400 });

  try {
    const url = normalizeListingUrl(rawUrl);
    const scraped = await scrapeListing(url);
    return NextResponse.json({ scraped: { ...scraped, url } });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
