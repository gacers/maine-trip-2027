import type { SupabaseClient } from "@supabase/supabase-js";
import type { docs_v1 } from "googleapis";
import { getDocsClient } from "@/lib/googleDocsAuth";
import { createDocInDrive } from "@/lib/drive";
import { getStopsForTrip } from "@/lib/itineraryStops";
import { getOrComputeRoute } from "@/lib/routeCache";
import { toGoogleTravelMode, ITINERARY_TRAVEL_MODE_CONNECTOR_LABEL } from "@/lib/itineraryTravelMode";
import { formatDuration } from "@/lib/formatDuration";
import type { Trip, ItineraryStop } from "@/lib/types";

export interface ExportResult {
  docId: string;
  docUrl: string;
}

const KIND_LABEL: Record<string, string> = {
  lodging: "Lodging",
  activity: "Activity",
  meal: "Meal",
  bar: "Bar",
  transport: "Transport",
  other: "Other",
};

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function formatDay(date: string | null): string {
  if (!date) return "Unscheduled";
  const d = new Date(`${date}T00:00:00`);
  return d.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
}

function formatTime(time: string | null): string | null {
  if (!time) return null;
  const [h, m] = time.slice(0, 5).split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 || 12;
  return `${hour12}:${pad(m)} ${period}`;
}

function mapsSearchUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
}

export interface StyleRun {
  start: number;
  end: number;
  style: "title" | "day" | "bold" | "italic" | "bullet" | "child-bullet" | "indent" | "connector" | "link";
  /** Only meaningful for "link" runs. */
  url?: string;
}

// Builds the whole doc body as one plain-text string plus a list of
// style runs (character ranges into that same string) — one insertText
// covering the full text, then one paragraph/text-style request per
// run, is far simpler than trying to insert and style paragraph by
// paragraph one at a time. ✓-confirmed stops read as the normal/solid
// entry; tentative/archived are italicized (Docs' nearest equivalent
// to "dimmed") rather than hidden — same "keep discarded options
// visible" posture as the web page itself.
//
// Async now (was pure text-building before) — computing the drive-
// time/leave-by line between two coordinate-bearing stops needs a real
// Directions lookup, same cached one the site's own RouteConnector
// uses (see lib/routeCache.ts): the whole *combined* app usage for a
// given stop-pair still only ever asks Google once (until that mode's
// TTL expires), whether that first ask came from someone viewing the
// page or someone clicking Export.
export async function buildDocContent(
  supabase: SupabaseClient,
  tripName: string,
  stops: ItineraryStop[]
): Promise<{ text: string; runs: StyleRun[]; tabPositions: number[] }> {
  let text = "";
  const runs: StyleRun[] = [];
  // Position of every leading tab inserted for a child bullet (see the
  // "bullet"/"child-bullet" runs below) — requestsFromContent needs
  // these to correctly translate later ranges once each tab gets
  // consumed by its own createParagraphBullets call.
  const tabPositions: number[] = [];
  const append = (s: string) => {
    text += s;
  };
  const mark = (start: number, style: StyleRun["style"], url?: string) => runs.push({ start, end: text.length, style, url });

  let start = text.length;
  append(`${tripName} — Itinerary\n\n`);
  mark(start, "title");

  let lastDate: string | null | undefined;
  let sawAnyDate = false;
  let prevStop: ItineraryStop | null = null;

  for (const stop of stops) {
    if (stop.date !== lastDate) {
      lastDate = stop.date;
      sawAnyDate = true;
      start = text.length;
      append(`${formatDay(stop.date)}\n`);
      mark(start, "day");
    }

    // The drive-time/leave-by line between this stop and the previous
    // one — same conditions RouteConnector uses on the site (both
    // sides need coordinates), same cache, same car_service ->
    // "driving" mapping (a car service drives the same roads a regular
    // car would — see toGoogleTravelMode).
    if (prevStop && prevStop.lat != null && prevStop.lng != null && stop.lat != null && stop.lng != null) {
      const route = await getOrComputeRoute(
        supabase,
        { lat: prevStop.lat, lng: prevStop.lng },
        { lat: stop.lat, lng: stop.lng },
        toGoogleTravelMode(stop.travel_mode)
      ).catch(() => null);
      if (route) {
        let line = `↓ ${route.text} ${ITINERARY_TRAVEL_MODE_CONNECTOR_LABEL[stop.travel_mode]}`;
        if (stop.time) {
          const arrival = new Date(`${stop.date}T${stop.time.slice(0, 5)}:00`);
          if (!Number.isNaN(arrival.getTime())) {
            const leaveBy = new Date(arrival.getTime() - route.durationSeconds * 1000);
            line += ` — leave by ${leaveBy.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`;
          }
        }
        start = text.length;
        append(`${line}\n`);
        mark(start, "connector");
      }
    }

    const time = formatTime(stop.time);
    const prefix = stop.status === "confirmed" ? "✓ " : "";
    const suffix = stop.status === "archived" ? "  (archived)" : stop.status === "tentative" ? "  (tentative)" : "";
    const titleLine = `${time ? `${time} — ` : ""}${prefix}${stop.title}${suffix}`;
    const titleParaStart = text.length;
    append(titleLine);
    mark(titleParaStart, stop.status === "confirmed" ? "bold" : "italic");

    // A real link, not just a URL printed as text — the stop's own
    // link when it has one (its linked entry's own site, or a custom
    // stop's own URL), falling back to a Google Maps search on its
    // coordinates so there's still SOME way to get directions from the
    // doc alone, without the itinerary page open alongside it.
    const directionsUrl = stop.url || (stop.lat != null && stop.lng != null ? mapsSearchUrl(stop.lat, stop.lng) : null);
    if (directionsUrl) {
      const linkStart = text.length;
      append("  (directions)");
      mark(linkStart, "link", directionsUrl);
    }
    append("\n");

    // The Kind label ("Activity"/"Meal"/etc.) as a genuine CHILD
    // bullet nested under the title's own bullet — not just indented
    // plain text — matching the literal "hit enter, tab over one
    // space" gesture that'd take by hand in the Docs UI. That gesture
    // is literally what Docs' own nesting inference keys off of: a
    // createParagraphBullets call counts each paragraph's own LEADING
    // TAB characters to decide its level (confirmed live — a plain
    // indentStart/indentFirstLine difference alone, tried first, was
    // NOT enough; both paragraphs came back at level 0). The leading
    // tab itself gets consumed into the bullet's own nesting, not left
    // behind as visible text.
    const metaBits = [KIND_LABEL[stop.kind] || stop.kind];
    if (stop.duration_minutes) metaBits.push(formatDuration(stop.duration_minutes));
    const kindStart = text.length;
    tabPositions.push(kindStart);
    append(`\t${metaBits.join(" · ")}\n`);
    mark(titleParaStart, "bullet");
    mark(kindStart, "child-bullet");

    if (stop.notes) {
      start = text.length;
      append(`${stop.notes}\n`);
      mark(start, "indent");
    }
    append("\n");

    prevStop = stop;
  }

  if (!sawAnyDate && stops.length === 0) {
    append("Nothing on the itinerary yet.\n");
  }

  return { text, runs, tabPositions };
}

// Docs body content starts at index 1 — a run at [start, end) in the
// plain-text string above maps to document range [1+start, 1+end)
// once that whole string has been inserted at index 1.
function requestsFromContent(text: string, runs: StyleRun[], tabPositions: number[]): docs_v1.Schema$Request[] {
  const requests: docs_v1.Schema$Request[] = [{ insertText: { location: { index: 1 }, text } }];
  // createParagraphBullets on a paragraph that starts with a leading
  // tab (used to signal nesting depth — see the "bullet" run's own
  // call site) consumes that tab as part of establishing the nesting
  // level instead of leaving it as visible text, shrinking every index
  // AFTER it by one — confirmed live: an uncorrected batch failed with
  // an out-of-bounds range on a later request, off by exactly the
  // number of nested bullets already applied earlier in the same
  // batch. shiftFor(i) counts consumed tabs STRICTLY BEFORE i (not
  // <=) — the "<=" version looked right at first too, but is off by
  // one for a boundary that sits exactly AT a tab's own position (the
  // child-bullet run's own start, always == that tab's position):
  // removing a single character collapses the boundary just-before it
  // and just-after it into the same new position, so a boundary AT the
  // removed character is unaffected by that specific removal, only by
  // earlier ones.
  const sortedTabs = [...tabPositions].sort((a, b) => a - b);
  function shiftFor(index: number): number {
    let count = 0;
    for (const p of sortedTabs) {
      if (p < index) count++;
      else break;
    }
    return count;
  }
  for (const run of runs) {
    const range = { startIndex: 1 + run.start - shiftFor(run.start), endIndex: 1 + run.end - shiftFor(run.end) };
    if (run.style === "title") {
      requests.push({ updateParagraphStyle: { range, paragraphStyle: { namedStyleType: "TITLE" }, fields: "namedStyleType" } });
    } else if (run.style === "day") {
      requests.push({ updateParagraphStyle: { range, paragraphStyle: { namedStyleType: "HEADING_2" }, fields: "namedStyleType" } });
    } else if (run.style === "bold") {
      requests.push({ updateTextStyle: { range, textStyle: { bold: true }, fields: "bold" } });
    } else if (run.style === "italic") {
      requests.push({
        updateTextStyle: {
          range,
          textStyle: { italic: true, foregroundColor: { color: { rgbColor: { red: 0.45, green: 0.45, blue: 0.45 } } } },
          fields: "italic,foregroundColor",
        },
      });
    } else if (run.style === "bullet") {
      requests.push({
        createParagraphBullets: { range, bulletPreset: "BULLET_DISC_CIRCLE_SQUARE" },
      });
    } else if (run.style === "child-bullet") {
      // Re-asserts the child bullet's own rendered text column back to
      // the same 36pt everything else on the page lands at (its
      // inferred nesting level's own default was 72pt — confirmed live
      // via the doc's own "lists" resource) — being nested one level
      // deeper structurally isn't meant to also read as visually
      // indented further. Same hanging-indent shape as the title's own
      // bullet (indentFirstLine 18 for the glyph, indentStart 36 for
      // the text), plus a little space below so it doesn't sit jammed
      // against the connector line right underneath it.
      requests.push({
        updateParagraphStyle: {
          range,
          paragraphStyle: {
            indentFirstLine: { magnitude: 18, unit: "PT" },
            indentStart: { magnitude: 36, unit: "PT" },
            spaceBelow: { magnitude: 6, unit: "PT" },
          },
          fields: "indentFirstLine,indentStart,spaceBelow",
        },
      });
    } else if (run.style === "indent") {
      // indentStart alone only affects a paragraph's WRAPPED lines — a
      // single-line paragraph (every meta/notes line here) renders at
      // indentFirstLine instead, which defaults to 0 when never set.
      // The bulleted title line above lands at indentStart (36pt)
      // because its bullet's own hanging indent (indentFirstLine 18pt,
      // where the glyph sits, then a tab to indentStart) pushes its
      // TEXT to 36pt — confirmed live via the exported doc's own JSON.
      // Setting indentFirstLine here too is what actually makes this
      // line's text land at the same 36pt, instead of flush left.
      requests.push({
        updateParagraphStyle: {
          range,
          paragraphStyle: {
            indentFirstLine: { magnitude: 36, unit: "PT" },
            indentStart: { magnitude: 36, unit: "PT" },
          },
          fields: "indentFirstLine,indentStart",
        },
      });
    } else if (run.style === "connector") {
      // Same indent fix as "indent" above, plus the italic/dimmed
      // styling "indent"+"italic" used to be stacked to get, plus a
      // bit of space below it — this line sits right against the next
      // stop's bulleted title otherwise (the blank line between stops
      // only separates the END of one stop's block from the NEXT
      // stop's connector, not the connector from that stop's own
      // title right below it).
      requests.push({
        updateParagraphStyle: {
          range,
          paragraphStyle: {
            indentFirstLine: { magnitude: 36, unit: "PT" },
            indentStart: { magnitude: 36, unit: "PT" },
            spaceBelow: { magnitude: 6, unit: "PT" },
          },
          fields: "indentFirstLine,indentStart,spaceBelow",
        },
      });
      requests.push({
        updateTextStyle: {
          range,
          textStyle: { italic: true, foregroundColor: { color: { rgbColor: { red: 0.45, green: 0.45, blue: 0.45 } } } },
          fields: "italic,foregroundColor",
        },
      });
    } else if (run.style === "link" && run.url) {
      requests.push({
        updateTextStyle: {
          range,
          textStyle: { link: { url: run.url }, foregroundColor: { color: { rgbColor: { red: 0.06, green: 0.36, blue: 0.77 } } } },
          fields: "link,foregroundColor",
        },
      });
    }
  }
  return requests;
}

// Explicit-only (no auto-export on every stop write, unlike the Sheets
// export) — an itinerary doc is an occasional "get me something to
// share" action, not a live sync, so there's just this one throwing
// version: a real failure should reach whoever clicked the button.
// Always a full regenerate (delete existing body, reinsert), not an
// incremental diff — simplest, and matches "regenerate a plan" rather
// than "keep a live-synced spreadsheet."
export async function exportItineraryOrThrow(supabase: SupabaseClient, trip: Trip): Promise<ExportResult> {
  const stops = await getStopsForTrip(supabase, trip.id);

  const { data: settings } = await supabase
    .from("app_settings")
    .select("google_drive_folder_id")
    .eq("id", true)
    .maybeSingle();

  let docId = trip.google_itinerary_doc_id;
  let docUrl = trip.google_itinerary_doc_url;

  if (!docId) {
    const created = await createDocInDrive(`${trip.name} — Itinerary`, settings?.google_drive_folder_id);
    docId = created.id;
    docUrl = created.url;
    await supabase.from("trips").update({ google_itinerary_doc_id: docId, google_itinerary_doc_url: docUrl }).eq("id", trip.id);
  }

  const docs = await getDocsClient();

  const existing = await docs.documents.get({ documentId: docId! });
  const content = existing.data.body?.content || [];
  const endIndex = content.length > 0 ? content[content.length - 1].endIndex || 1 : 1;

  const requests: docs_v1.Schema$Request[] = [];
  // A brand-new (or already-emptied) doc's body is just one empty
  // paragraph -- endIndex 2 -- with nothing real to delete; anything
  // beyond that is previous export content to clear before rewriting.
  if (endIndex > 2) {
    requests.push({ deleteContentRange: { range: { startIndex: 1, endIndex: endIndex - 1 } } });
  }

  const { text, runs, tabPositions } = await buildDocContent(supabase, trip.name, stops);
  requests.push(...requestsFromContent(text, runs, tabPositions));

  await docs.documents.batchUpdate({ documentId: docId!, requestBody: { requests } });

  return { docId: docId!, docUrl: docUrl! };
}
